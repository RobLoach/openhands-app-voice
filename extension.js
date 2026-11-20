// Built from src/ and @readium/speech by `npm run build`; edit src/ instead.
// It bundles packages under their own licenses, in THIRD_PARTY_LICENSES.txt.
// What this app keeps in the browser's localStorage.

const STORAGE_KEY = 'openhands-voice:settings';

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

// Stores a value as JSON, or removes it for null. Storage that's full or
// blocked just doesn't remember it.
function writeJson(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Nothing to keep then.
  }
}

// What Voice chat, Hands-free and Read aloud buttons need from the browser.

function speechProblem() {
  return window.speechSynthesis && window.SpeechSynthesisUtterance
    ? null
    : "Your browser can't read text aloud.";
}

async function requestMic() {
  if (!window.navigator.mediaDevices?.getUserMedia) {
    return 'Your browser only lets apps use the mic over HTTPS or on localhost.';
  }
  try {
    const stream = await window.navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return null;
  } catch {
    return 'The mic is blocked for this site in your browser settings.';
  }
}

// The settings: each feature's switch, kept in localStorage.


// A switch with options is a choice between them instead, starting at its
// default, and one with voices a choice of the browser's voices, by name.
// check() says why a switch can't work, e.g. after a permission was revoked;
// enable(), which defaults to check(), may also ask the browser for what it
// needs. The settings page lists them under their group, in this order.
const SWITCH_GROUPS = ['Talking', 'Reading aloud'];
const SWITCHES = [
  {
    key: 'voiceChat',
    group: 'Talking',
    label: 'Voice chat',
    description:
      "After you use the mic, send your message, read the agent's reply aloud, then listen again.",
    check: speechProblem,
  },
  {
    key: 'handsFree',
    group: 'Talking',
    label: 'Hands-free',
    description: 'Stop the mic once you stop talking, so you never have to tap it.',
    enable: requestMic,
  },
  {
    key: 'micShortcut',
    group: 'Talking',
    label: 'Mic shortcut',
    description: "Press Alt+V to start or stop Canvas's mic, from the message box too.",
  },
  {
    key: 'readAloud',
    group: 'Reading aloud',
    label: 'Read aloud buttons',
    description: "Add a button to the agent's messages that reads them aloud.",
    check: speechProblem,
  },
  {
    key: 'voice',
    group: 'Reading aloud',
    label: 'Voice',
    description:
      "Which of your browser's English voices reads aloud. Voices marked online send what they read to Google or Microsoft.",
    voices: true,
    default: '',
  },
  {
    key: 'readingSpeed',
    group: 'Reading aloud',
    label: 'Reading speed',
    description: 'How fast replies and messages are read.',
    // Choices as [value, label, the speech rate].
    options: [
      ['0.75', '0.75×', 0.75],
      ['1', '1×', 1],
      ['1.25', '1.25×', 1.25],
      ['1.5', '1.5×', 1.5],
      ['1.75', '1.75×', 1.75],
      ['2', '2×', 2],
    ],
    default: '1',
  },
];
const DEFAULT_SETTINGS = Object.fromEntries(
  SWITCHES.map((item) => [item.key, item.default ?? false]),
);

let settings = DEFAULT_SETTINGS;

// Each switch's stored value, or its default where there's none, or it's
// not one of its choices.
function loadSettings() {
  const stored = readJson(STORAGE_KEY, {});
  settings = Object.fromEntries(
    SWITCHES.map((item) => {
      const value = stored?.[item.key];
      const valid = item.options
        ? item.options.some(([option]) => option === value)
        : typeof value === (item.voices ? 'string' : 'boolean');
      return [item.key, valid ? value : DEFAULT_SETTINGS[item.key]];
    }),
  );
}

// Saves the settings, or with none, removes them, turning every feature off.
function saveSettings(next) {
  settings = next ?? DEFAULT_SETTINGS;
  writeJson(STORAGE_KEY, next ?? null);
}

// Helpers for the elements this app adds to Canvas's page, and the classes
// it borrows from Canvas's own components.

// Marks the elements this app adds to Canvas's page.
const OWN_ATTR = 'data-voice-own';

// An element with these classes, holding text or other nodes.
function el(tag, className, ...children) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.append(...children);
  return element;
}

// Class strings from Canvas's own components, so they're compiled.
const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
const HAS_FOCUS_RING =
  'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus';

function textButton(testid, text, onClick, look = 'underline') {
  const button = el('button', `w-fit cursor-pointer rounded-sm text-sm ${look} ${FOCUS_RING}`, text);
  button.type = 'button';
  button.dataset.testid = testid;
  button.addEventListener('click', onClick);
  return button;
}

// The parts of this app's pages, as Canvas lays out its settings pages.
const pageHeader = (title, description) =>
  el(
    'div',
    'min-w-0 space-y-1',
    el('h2', 'text-xl font-semibold leading-6 text-foreground', title),
    el('p', 'max-w-2xl text-sm text-tertiary-light', description),
  );
const pageSection = (title, ...children) =>
  el('section', 'flex min-w-0 flex-col gap-3', el('h3', 'text-base font-semibold text-foreground', title), ...children);

const isString = obj => typeof obj === 'string';
const defer = () => {
  let res;
  let rej;
  const promise = new Promise((resolve, reject) => {
    res = resolve;
    rej = reject;
  });
  promise.resolve = res;
  promise.reject = rej;
  return promise;
};
const makeString = object => {
  if (object == null) return '';
  return String(object);
};
const isSafeLanguageCode = code => isString(code) && /^[A-Za-z0-9_@.-]{1,128}$/.test(code) && !code.includes('..') && !['__proto__', 'constructor', 'prototype'].includes(code);
const callbackApiOf = plugin => plugin?.callbackApi ?? plugin?.constructor?.callbackApi;
const copy = (a, s, t) => {
  a.forEach(m => {
    if (s[m]) t[m] = s[m];
  });
};
const lastOfPathSeparatorRegExp = /###/g;
const cleanKey = key => key && key.includes('###') ? key.replace(lastOfPathSeparatorRegExp, '.') : key;
const canNotTraverseDeeper = object => !object || isString(object);
const getLastOfPath = (object, path, Empty) => {
  const stack = !isString(path) ? path : path.split('.');
  let stackIndex = 0;
  while (stackIndex < stack.length - 1) {
    if (canNotTraverseDeeper(object)) return {};
    const key = cleanKey(stack[stackIndex]);
    if (!object[key] && Empty) object[key] = new Empty();
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      object = object[key];
    } else {
      object = {};
    }
    ++stackIndex;
  }
  if (canNotTraverseDeeper(object)) return {};
  return {
    obj: object,
    k: cleanKey(stack[stackIndex])
  };
};
const setPath = (object, path, newValue) => {
  const {
    obj,
    k
  } = getLastOfPath(object, path, Object);
  if (obj !== undefined || path.length === 1) {
    obj[k] = newValue;
    return;
  }
  let e = path[path.length - 1];
  let p = path.slice(0, path.length - 1);
  let last = getLastOfPath(object, p, Object);
  while (last.obj === undefined && p.length) {
    e = `${p[p.length - 1]}.${e}`;
    p = p.slice(0, p.length - 1);
    last = getLastOfPath(object, p, Object);
    if (last?.obj && typeof last.obj[`${last.k}.${e}`] !== 'undefined') {
      last.obj = undefined;
    }
  }
  last.obj[`${last.k}.${e}`] = newValue;
};
const pushPath = (object, path, newValue, concat) => {
  const {
    obj,
    k
  } = getLastOfPath(object, path, Object);
  obj[k] = obj[k] || [];
  obj[k].push(newValue);
};
const getPath = (object, path) => {
  const {
    obj,
    k
  } = getLastOfPath(object, path);
  if (!obj) return undefined;
  if (!Object.prototype.hasOwnProperty.call(obj, k)) return undefined;
  return obj[k];
};
const getPathWithDefaults = (data, defaultData, key) => {
  const value = getPath(data, key);
  if (value !== undefined) {
    return value;
  }
  return getPath(defaultData, key);
};
const deepExtend = (target, source, overwrite) => {
  for (const prop in source) {
    if (prop !== '__proto__' && prop !== 'constructor') {
      if (Object.prototype.hasOwnProperty.call(target, prop)) {
        if (isString(target[prop]) || target[prop] instanceof String || isString(source[prop]) || source[prop] instanceof String) {
          if (overwrite) target[prop] = source[prop];
        } else {
          deepExtend(target[prop], source[prop], overwrite);
        }
      } else {
        target[prop] = source[prop];
      }
    }
  }
  return target;
};
const regexEscape = str => str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
const _entityMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;'
};
const escape = data => {
  if (isString(data)) {
    return data.replace(/[&<>"'\/]/g, s => _entityMap[s]);
  }
  return data;
};
class RegExpCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.regExpMap = new Map();
    this.regExpQueue = [];
  }
  getRegExp(pattern) {
    const regExpFromCache = this.regExpMap.get(pattern);
    if (regExpFromCache !== undefined) {
      return regExpFromCache;
    }
    const regExpNew = new RegExp(pattern);
    if (this.regExpQueue.length === this.capacity) {
      this.regExpMap.delete(this.regExpQueue.shift());
    }
    this.regExpMap.set(pattern, regExpNew);
    this.regExpQueue.push(pattern);
    return regExpNew;
  }
}
const chars = [' ', ',', '?', '!', ';'];
const looksLikeObjectPathRegExpCache = new RegExpCache(20);
const looksLikeObjectPath = (key, nsSeparator, keySeparator) => {
  nsSeparator = nsSeparator || '';
  keySeparator = keySeparator || '';
  const possibleChars = chars.filter(c => !nsSeparator.includes(c) && !keySeparator.includes(c));
  if (possibleChars.length === 0) return true;
  const r = looksLikeObjectPathRegExpCache.getRegExp(`(${possibleChars.map(c => c === '?' ? '\\?' : c).join('|')})`);
  let matched = !r.test(key);
  if (!matched) {
    const ki = key.indexOf(keySeparator);
    if (ki > 0 && !r.test(key.substring(0, ki))) {
      matched = true;
    }
  }
  return matched;
};
const deepFind = (obj, path, keySeparator = '.') => {
  if (!obj) return undefined;
  if (obj[path]) {
    if (!Object.prototype.hasOwnProperty.call(obj, path)) return undefined;
    return obj[path];
  }
  const tokens = path.split(keySeparator);
  let current = obj;
  for (let i = 0; i < tokens.length;) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    let next;
    let nextPath = '';
    for (let j = i; j < tokens.length; ++j) {
      if (j !== i) {
        nextPath += keySeparator;
      }
      nextPath += tokens[j];
      next = current[nextPath];
      if ((typeof next === 'function' || nextPath === '__proto__') && !Object.prototype.hasOwnProperty.call(current, nextPath)) {
        next = undefined;
      }
      if (next !== undefined) {
        if (['string', 'number', 'boolean'].includes(typeof next) && j < tokens.length - 1) {
          continue;
        }
        i += j - i + 1;
        break;
      }
    }
    current = next;
  }
  return current;
};
const getCleanedCode = code => code?.replace(/_/g, '-');

const consoleLogger = {
  type: 'logger',
  log(args) {
    this.output('log', args);
  },
  warn(args) {
    this.output('warn', args);
  },
  error(args) {
    this.output('error', args);
  },
  output(type, args) {
    console?.[type]?.apply?.(console, args);
  }
};
class Logger {
  constructor(concreteLogger, options = {}) {
    this.init(concreteLogger, options);
  }
  init(concreteLogger, options = {}) {
    this.prefix = options.prefix || 'i18next:';
    this.logger = concreteLogger || consoleLogger;
    this.options = options;
    this.debug = options.debug;
    this.seen = new Set();
  }
  log(...args) {
    return this.forward(args, 'log', '', true);
  }
  warn(...args) {
    return this.forward(args, 'warn', '', true);
  }
  error(...args) {
    return this.forward(args, 'error', '');
  }
  deprecate(...args) {
    return this.forward(args, 'warn', 'WARNING DEPRECATED: ', true);
  }
  once(key, lvl, ...args) {
    if (!this.debug || this.seen.has(key) || this.seen.size >= 1000) return null;
    this.seen.add(key);
    return this[lvl](...args);
  }
  forward(args, lvl, prefix, debugOnly) {
    if (debugOnly && !this.debug) return null;
    args = args.map(a => isString(a) ? a.replace(/[\r\n\x00-\x1F\x7F]/g, ' ') : a);
    if (isString(args[0])) args[0] = `${prefix}${this.prefix} ${args[0]}`;
    return this.logger[lvl](args);
  }
  create(moduleName) {
    return new Logger(this.logger, {
      ...{
        prefix: `${this.prefix}:${moduleName}:`
      },
      ...this.options
    });
  }
  clone(options) {
    options = options || this.options;
    options.prefix = options.prefix || this.prefix;
    return new Logger(this.logger, options);
  }
}
var baseLogger = new Logger();

class EventEmitter {
  constructor() {
    this.observers = {};
  }
  on(events, listener) {
    events.split(' ').forEach(event => {
      if (!this.observers[event]) this.observers[event] = new Map();
      const numListeners = this.observers[event].get(listener) || 0;
      this.observers[event].set(listener, numListeners + 1);
    });
    return this;
  }
  off(events, listener) {
    (typeof events === 'string' ? events.split(' ') : [events]).forEach(event => {
      if (!this.observers[event]) return;
      if (!listener) {
        delete this.observers[event];
        return;
      }
      this.observers[event].delete(listener);
    });
  }
  once(event, listener) {
    const wrapper = (...args) => {
      listener(...args);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
    return this;
  }
  emit(event, ...args) {
    if (this.observers[event]) {
      const cloned = Array.from(this.observers[event].entries());
      cloned.forEach(([observer, numTimesAdded]) => {
        for (let i = 0; i < numTimesAdded; i++) {
          observer(...args);
        }
      });
    }
    if (this.observers['*']) {
      const cloned = Array.from(this.observers['*'].entries());
      cloned.forEach(([observer, numTimesAdded]) => {
        for (let i = 0; i < numTimesAdded; i++) {
          observer(event, ...args);
        }
      });
    }
  }
}

const nonEmptyBundles = new WeakSet();
class ResourceStore extends EventEmitter {
  constructor(data, options = {
    ns: ['translation'],
    defaultNS: 'translation'
  }) {
    super();
    this.data = data || {};
    this.options = options;
    this.logger = baseLogger.create('resourceStore');
    if (this.options.keySeparator === undefined) {
      this.options.keySeparator = '.';
    }
    if (this.options.ignoreJSONStructure === undefined) {
      this.options.ignoreJSONStructure = true;
    }
  }
  addNamespaces(ns) {
    if (!this.options.ns.includes(ns)) {
      this.options.ns.push(ns);
    }
  }
  removeNamespaces(ns) {
    const index = this.options.ns.indexOf(ns);
    if (index > -1) {
      this.options.ns.splice(index, 1);
    }
  }
  deprecateDottedLng(method) {
    this.logger.once(method, 'deprecate', `${method}: a dotted language ('en.translation.key') that carries the namespace and key is removed in v27; pass language, namespace and key as separate arguments`);
  }
  getResource(lng, ns, key, options = {}) {
    const keySeparator = options.keySeparator !== undefined ? options.keySeparator : this.options.keySeparator;
    const ignoreJSONStructure = options.ignoreJSONStructure !== undefined ? options.ignoreJSONStructure : this.options.ignoreJSONStructure;
    let path;
    if (lng.includes('.')) {
      this.deprecateDottedLng('getResource');
      path = lng.split('.');
    } else {
      path = [lng, ns];
      if (key) {
        if (Array.isArray(key)) {
          path.push(...key);
        } else if (isString(key) && keySeparator) {
          path.push(...key.split(keySeparator));
        } else {
          path.push(key);
        }
      }
    }
    const result = getPath(this.data, path);
    if (result == null && !ns && !key && lng.includes('.')) {
      lng = path[0];
      ns = path[1];
      key = path.slice(2).join('.');
    }
    if (result != null || !ignoreJSONStructure || !isString(key)) return result;
    return deepFind(this.data?.[lng]?.[ns], key, keySeparator);
  }
  addResource(lng, ns, key, value, options = {
    silent: false
  }) {
    const keySeparator = options.keySeparator !== undefined ? options.keySeparator : this.options.keySeparator;
    let path = [lng, ns];
    if (key) path = path.concat(keySeparator ? key.split(keySeparator) : key);
    if (lng.includes('.')) {
      this.deprecateDottedLng('addResource');
      path = lng.split('.');
      value = ns;
      ns = path[1];
    }
    this.addNamespaces(ns);
    setPath(this.data, path, value);
    if (!options.silent) this.emit('added', lng, ns, key, value);
  }
  addResources(lng, ns, resources, options = {
    silent: false
  }) {
    for (const m in resources) {
      if (isString(resources[m]) || Array.isArray(resources[m])) this.addResource(lng, ns, m, resources[m], {
        silent: true
      });
    }
    if (!options.silent) this.emit('added', lng, ns, resources);
  }
  addResourceBundle(lng, ns, resources, deep, overwrite, options = {
    silent: false,
    skipCopy: false
  }) {
    let path = [lng, ns];
    if (lng.includes('.')) {
      this.deprecateDottedLng('addResourceBundle');
      path = lng.split('.');
      deep = resources;
      resources = ns;
      ns = path[1];
    }
    this.addNamespaces(ns);
    let pack = getPath(this.data, path) || {};
    if (!options.skipCopy) resources = JSON.parse(JSON.stringify(resources));
    if (deep) {
      deepExtend(pack, resources, overwrite);
    } else {
      pack = {
        ...pack,
        ...resources
      };
    }
    setPath(this.data, path, pack);
    if (!options.silent) this.emit('added', lng, ns, resources);
  }
  removeResourceBundle(lng, ns) {
    if (this.hasResourceBundle(lng, ns)) {
      delete this.data[lng][ns];
    }
    this.removeNamespaces(ns);
    this.emit('removed', lng, ns);
  }
  hasResourceBundle(lng, ns) {
    return this.getResource(lng, ns) !== undefined;
  }
  getResourceBundle(lng, ns) {
    if (!ns) ns = this.options.defaultNS;
    return this.getResource(lng, ns);
  }
  getDataByLanguage(lng) {
    return this.data[lng];
  }
  hasLanguageSomeTranslations(lng) {
    const data = this.getDataByLanguage(lng);
    const n = data && Object.keys(data) || [];
    return !!n.find(v => {
      const bundle = data[v];
      if (nonEmptyBundles.has(bundle)) return true;
      if (!bundle || Object.keys(bundle).length === 0) return false;
      if (typeof bundle === 'object') nonEmptyBundles.add(bundle);
      return true;
    });
  }
  toJSON() {
    return this.data;
  }
}

var postProcessor = {
  processors: {},
  addPostProcessor(module) {
    this.processors[module.name] = module;
  },
  handle(processors, value, key, options, translator) {
    processors.forEach(processor => {
      value = this.processors[processor]?.process(value, key, options, translator) ?? value;
    });
    return value;
  }
};

const PATH_KEY = Symbol('i18next/PATH_KEY');
function createProxy() {
  const state = [];
  const handler = Object.create(null);
  let proxy;
  handler.get = (target, key) => {
    proxy?.revoke?.();
    if (key === PATH_KEY) return state;
    state.push(key);
    proxy = Proxy.revocable(target, handler);
    return proxy.proxy;
  };
  return Proxy.revocable(Object.create(null), handler).proxy;
}
function keysFromSelector(selector, opts) {
  const {
    [PATH_KEY]: path
  } = selector(createProxy());
  const keySeparator = opts?.keySeparator ?? '.';
  const nsSeparator = opts?.nsSeparator ?? ':';
  const strict = opts?.enableSelector === 'strict';
  if (path.length > 1 && nsSeparator) {
    const ns = opts?.ns;
    const nsList = strict ? Array.isArray(ns) ? ns : ns ? [ns] : null : Array.isArray(ns) ? ns : null;
    if (nsList) {
      const candidates = strict ? nsList : nsList.length > 1 ? nsList.slice(1) : [];
      if (candidates.includes(path[0])) {
        return `${path[0]}${nsSeparator}${path.slice(1).join(keySeparator)}`;
      }
    }
  }
  return path.join(keySeparator);
}

const shouldHandleAsObject = res => !isString(res) && typeof res !== 'boolean' && typeof res !== 'number';
class Translator extends EventEmitter {
  constructor(services, options = {}) {
    super();
    copy(['resourceStore', 'languageUtils', 'pluralResolver', 'interpolator', 'backendConnector', 'i18nFormat', 'utils', 'ownPostProcessors'], services, this);
    this.options = options;
    if (this.options.keySeparator === undefined) {
      this.options.keySeparator = '.';
    }
    this.logger = baseLogger.create('translator');
    this.checkedLoadedFor = {};
  }
  changeLanguage(lng) {
    if (lng) this.language = lng;
  }
  exists(key, o = {
    interpolation: {}
  }) {
    const opt = {
      ...o
    };
    if (key == null) return false;
    const resolved = this.resolve(key, opt);
    if (resolved?.res === undefined) return false;
    const isObject = shouldHandleAsObject(resolved.res);
    if (opt.returnObjects === false && isObject) {
      return false;
    }
    return true;
  }
  extractFromKey(key, opt) {
    let nsSeparator = opt.nsSeparator !== undefined ? opt.nsSeparator : this.options.nsSeparator;
    if (nsSeparator === undefined) nsSeparator = ':';
    const keySeparator = opt.keySeparator !== undefined ? opt.keySeparator : this.options.keySeparator;
    let namespaces = opt.ns || this.options.defaultNS || [];
    const wouldCheckForNsInKey = nsSeparator && key.includes(nsSeparator);
    const seemsNaturalLanguage = !this.options.userDefinedKeySeparator && !opt.keySeparator && !this.options.userDefinedNsSeparator && !opt.nsSeparator && !looksLikeObjectPath(key, nsSeparator, keySeparator);
    if (wouldCheckForNsInKey && !seemsNaturalLanguage) {
      const m = key.match(this.interpolator.nestingRegexp);
      if (m && m.length > 0) {
        return {
          key,
          namespaces: isString(namespaces) ? [namespaces] : namespaces
        };
      }
      const parts = key.split(nsSeparator);
      if (nsSeparator !== keySeparator || nsSeparator === keySeparator && this.options.ns.includes(parts[0])) namespaces = parts.shift();
      key = parts.join(keySeparator);
    }
    return {
      key,
      namespaces: isString(namespaces) ? [namespaces] : namespaces
    };
  }
  translate(keys, o, lastKey) {
    let opt = typeof o === 'object' ? {
      ...o
    } : o;
    if (typeof opt !== 'object' && this.options.overloadTranslationOptionHandler) {
      opt = this.options.overloadTranslationOptionHandler(arguments);
    }
    if (typeof opt === 'object') opt = {
      ...opt
    };
    if (!opt) opt = {};
    if (keys == null) return '';
    if (typeof keys === 'function') keys = keysFromSelector(keys, {
      ...this.options,
      ...opt
    });
    if (!Array.isArray(keys)) keys = [String(keys)];
    keys = keys.map(k => typeof k === 'function' ? keysFromSelector(k, {
      ...this.options,
      ...opt
    }) : String(k));
    const returnDetails = opt.returnDetails !== undefined ? opt.returnDetails : this.options.returnDetails;
    const keySeparator = opt.keySeparator !== undefined ? opt.keySeparator : this.options.keySeparator;
    const {
      key,
      namespaces
    } = this.extractFromKey(keys[keys.length - 1], opt);
    const namespace = namespaces[namespaces.length - 1];
    let nsSeparator = opt.nsSeparator !== undefined ? opt.nsSeparator : this.options.nsSeparator;
    if (nsSeparator === undefined) nsSeparator = ':';
    const lng = opt.lng || this.language;
    const appendNamespaceToCIMode = opt.appendNamespaceToCIMode || this.options.appendNamespaceToCIMode;
    if (lng?.toLowerCase() === 'cimode') {
      if (appendNamespaceToCIMode) {
        if (returnDetails) {
          return {
            res: `${namespace}${nsSeparator}${key}`,
            usedKey: key,
            exactUsedKey: key,
            usedLng: lng,
            usedNS: namespace,
            usedParams: this.getUsedParamsDetails(opt)
          };
        }
        return `${namespace}${nsSeparator}${key}`;
      }
      if (returnDetails) {
        return {
          res: key,
          usedKey: key,
          exactUsedKey: key,
          usedLng: lng,
          usedNS: namespace,
          usedParams: this.getUsedParamsDetails(opt)
        };
      }
      return key;
    }
    const resolved = this.resolve(keys, opt);
    let res = resolved?.res;
    const resUsedKey = resolved?.usedKey || key;
    const resExactUsedKey = resolved?.exactUsedKey || key;
    const noObject = ['[object Number]', '[object Function]', '[object RegExp]'];
    const joinArrays = opt.joinArrays !== undefined ? opt.joinArrays : this.options.joinArrays;
    const handleAsObjectInI18nFormat = !this.i18nFormat || this.i18nFormat.handleAsObject;
    const needsPluralHandling = opt.count !== undefined && !isString(opt.count);
    const hasDefaultValue = Translator.hasDefaultValue(opt);
    const defaultValueSuffix = needsPluralHandling ? this.pluralResolver.getSuffix(lng, opt.count, opt) : '';
    const defaultValueSuffixOrdinalFallback = opt.ordinal && needsPluralHandling ? this.pluralResolver.getSuffix(lng, opt.count, {
      ordinal: false
    }) : '';
    const needsZeroSuffixLookup = needsPluralHandling && !opt.ordinal && opt.count === 0;
    const defaultValue = needsZeroSuffixLookup && opt[`defaultValue${this.options.pluralSeparator}zero`] || opt[`defaultValue${defaultValueSuffix}`] || opt[`defaultValue${defaultValueSuffixOrdinalFallback}`] || opt.defaultValue;
    let resForObjHndl = res;
    if (handleAsObjectInI18nFormat && !res && hasDefaultValue) {
      resForObjHndl = defaultValue;
    }
    const handleAsObject = shouldHandleAsObject(resForObjHndl);
    const resType = Object.prototype.toString.apply(resForObjHndl);
    if (handleAsObjectInI18nFormat && resForObjHndl && handleAsObject && !noObject.includes(resType) && !(isString(joinArrays) && Array.isArray(resForObjHndl))) {
      if (!opt.returnObjects && !this.options.returnObjects) {
        if (!this.options.returnedObjectHandler) {
          this.logger.warn('accessing an object - but returnObjects options is not enabled!');
          this.logger.once('returnedObject', 'deprecate', "accessing an object without returnObjects returns a sentence about it today; from v27 t() returns the key, as for a missing key (returnedObjectHandler can keep today's text)");
        }
        const r = this.options.returnedObjectHandler ? this.options.returnedObjectHandler(resUsedKey, resForObjHndl, {
          ...opt,
          ns: namespaces
        }) : `key '${key} (${this.language})' returned an object instead of string.`;
        if (returnDetails) {
          resolved.res = r;
          resolved.usedParams = this.getUsedParamsDetails(opt);
          return resolved;
        }
        return r;
      }
      if (keySeparator) {
        const resTypeIsArray = Array.isArray(resForObjHndl);
        const copy = resTypeIsArray ? [] : {};
        const newKeyToUse = resTypeIsArray ? resExactUsedKey : resUsedKey;
        for (const m in resForObjHndl) {
          if (Object.prototype.hasOwnProperty.call(resForObjHndl, m)) {
            const deepKey = `${newKeyToUse}${keySeparator}${m}`;
            if (hasDefaultValue && !res) {
              copy[m] = this.translate(deepKey, {
                ...opt,
                defaultValue: shouldHandleAsObject(defaultValue) ? defaultValue[m] : undefined,
                ...{
                  joinArrays: false,
                  ns: namespaces
                }
              });
            } else {
              copy[m] = this.translate(deepKey, {
                ...opt,
                ...{
                  joinArrays: false,
                  ns: namespaces
                }
              });
            }
            if (copy[m] === deepKey) copy[m] = resForObjHndl[m];
          }
        }
        res = copy;
      }
    } else if (handleAsObjectInI18nFormat && isString(joinArrays) && Array.isArray(res)) {
      res = res.join(joinArrays);
      if (res) res = this.extendTranslation(res, keys, opt, resolved, lastKey);
    } else {
      let usedDefault = false;
      let usedKey = false;
      if (!this.isValidLookup(res) && hasDefaultValue) {
        usedDefault = true;
        res = defaultValue;
      }
      if (!this.isValidLookup(res)) {
        usedKey = true;
        res = key;
      }
      const missingKeyNoValueFallbackToKey = opt.missingKeyNoValueFallbackToKey || this.options.missingKeyNoValueFallbackToKey;
      const resForMissing = missingKeyNoValueFallbackToKey && usedKey ? undefined : res;
      const updateMissing = hasDefaultValue && defaultValue !== res && this.options.updateMissing;
      if (usedKey || usedDefault || updateMissing) {
        this.logger.log(updateMissing ? 'updateKey' : 'missingKey', lng, namespace, needsPluralHandling && !updateMissing ? `${key}${this.pluralResolver.getSuffix(lng, opt.count, opt)}` : key, updateMissing ? defaultValue : res);
        if (keySeparator) {
          const fk = this.resolve(key, {
            ...opt,
            keySeparator: false
          });
          if (fk && fk.res) this.logger.warn('Seems the loaded translations were in flat JSON format instead of nested. Either set keySeparator: false on init or make sure your translations are published in nested format.');
        }
        let lngs = [];
        const fallbackLngs = this.languageUtils.getFallbackCodes(this.options.fallbackLng, opt.lng || this.language);
        if (this.options.saveMissingTo === 'fallback' && fallbackLngs && fallbackLngs[0]) {
          for (let i = 0; i < fallbackLngs.length; i++) {
            lngs.push(fallbackLngs[i]);
          }
        } else if (this.options.saveMissingTo === 'all') {
          lngs = this.languageUtils.toResolveHierarchy(opt.lng || this.language);
        } else {
          lngs.push(opt.lng || this.language);
        }
        const send = (l, k, specificDefaultValue) => {
          const defaultForMissing = hasDefaultValue && specificDefaultValue !== res ? specificDefaultValue : resForMissing;
          if (this.options.missingKeyHandler) {
            this.options.missingKeyHandler(l, namespace, k, defaultForMissing, updateMissing, opt);
          } else if (this.backendConnector?.saveMissing) {
            this.backendConnector.saveMissing(l, namespace, k, defaultForMissing, updateMissing, opt, undefined, this.utils?.hasLoadedNamespace);
          }
          this.emit('missingKey', l, namespace, k, res);
        };
        if (this.options.saveMissing) {
          if (this.options.saveMissingPlurals && needsPluralHandling) {
            lngs.forEach(language => {
              const suffixes = this.pluralResolver.getSuffixes(language, opt);
              if (needsZeroSuffixLookup && opt[`defaultValue${this.options.pluralSeparator}zero`] && !suffixes.includes(`${this.options.pluralSeparator}zero`)) {
                suffixes.push(`${this.options.pluralSeparator}zero`);
              }
              suffixes.forEach(suffix => {
                send([language], key + suffix, opt[`defaultValue${suffix}`] || defaultValue);
              });
            });
          } else {
            send(lngs, key, defaultValue);
          }
        }
      }
      res = this.extendTranslation(res, keys, opt, resolved, lastKey);
      if (usedKey && res === key && this.options.appendNamespaceToMissingKey) {
        res = `${namespace}${nsSeparator}${key}`;
      }
      if ((usedKey || usedDefault) && this.options.parseMissingKeyHandler) {
        res = this.options.parseMissingKeyHandler(this.options.appendNamespaceToMissingKey ? `${namespace}${nsSeparator}${key}` : key, usedDefault ? res : undefined, opt);
      }
    }
    if (returnDetails) {
      resolved.res = res;
      resolved.usedParams = this.getUsedParamsDetails(opt);
      return resolved;
    }
    return res;
  }
  extendTranslation(res, key, opt, resolved, lastKey) {
    if (this.i18nFormat?.parse) {
      res = this.i18nFormat.parse(res, {
        ...this.options.interpolation.defaultVariables,
        ...opt
      }, opt.lng || this.language || resolved.usedLng, resolved.usedNS, resolved.usedKey, {
        resolved
      });
    } else if (!opt.skipInterpolation) {
      if (opt.interpolation) this.interpolator.init({
        ...opt,
        ...{
          interpolation: {
            ...this.options.interpolation,
            ...opt.interpolation
          }
        }
      });
      const skipOnVariables = isString(res) && (opt?.interpolation?.skipOnVariables !== undefined ? opt.interpolation.skipOnVariables : this.options.interpolation.skipOnVariables);
      let nestBef;
      if (skipOnVariables) {
        const nb = res.match(this.interpolator.nestingRegexp);
        nestBef = nb && nb.length;
      }
      let data = opt.replace && !isString(opt.replace) ? opt.replace : opt;
      if (this.options.interpolation.defaultVariables) data = {
        ...this.options.interpolation.defaultVariables,
        ...data
      };
      res = this.interpolator.interpolate(res, data, opt.lng || this.language || resolved.usedLng, opt);
      if (skipOnVariables) {
        const na = res.match(this.interpolator.nestingRegexp);
        const nestAft = na && na.length;
        if (nestBef < nestAft) opt.nest = false;
      }
      if (!opt.lng && resolved && resolved.res) opt.lng = this.language || resolved.usedLng;
      if (opt.nest !== false) res = this.interpolator.nest(res, (...args) => {
        if (lastKey?.[0] === args[0] && !opt.context) {
          this.logger.warn(`It seems you are nesting recursively key: ${args[0]} in key: ${key[0]}`);
          return null;
        }
        return this.translate(...args, key);
      }, opt);
      if (opt.interpolation) this.interpolator.reset();
    }
    const postProcess = opt.postProcess || this.options.postProcess;
    const postProcessorNames = isString(postProcess) ? [postProcess] : postProcess;
    if (res != null && postProcessorNames?.length && opt.applyPostProcessor !== false) {
      postProcessorNames.forEach(name => {
        if (this.logger.debug && postProcessor.processors[name] && this.ownPostProcessors && !this.ownPostProcessors.has(name)) {
          this.logger.once(name, 'deprecate', `postProcess: '${name}' was registered with use() on another i18next instance; from v27 post-processors are per instance, so call use() with it on this instance too`);
        }
      });
      res = postProcessor.handle(postProcessorNames, res, key, this.options && this.options.postProcessPassResolved ? {
        i18nResolved: {
          ...resolved,
          usedParams: this.getUsedParamsDetails(opt)
        },
        ...opt
      } : opt, this);
    }
    return res;
  }
  resolve(keys, opt = {}) {
    let found;
    let usedKey;
    let exactUsedKey;
    let usedLng;
    let usedNS;
    if (isString(keys)) keys = [keys];
    if (Array.isArray(keys)) keys = keys.map(k => typeof k === 'function' ? keysFromSelector(k, {
      ...this.options,
      ...opt
    }) : k);
    keys.forEach(k => {
      if (this.isValidLookup(found)) return;
      const extracted = this.extractFromKey(k, opt);
      const key = extracted.key;
      usedKey = key;
      let namespaces = extracted.namespaces;
      if (this.options.fallbackNS) namespaces = namespaces.concat(this.options.fallbackNS);
      const needsPluralHandling = opt.count !== undefined && !isString(opt.count);
      const needsZeroSuffixLookup = needsPluralHandling && !opt.ordinal && opt.count === 0;
      const needsContextHandling = opt.context !== undefined && (isString(opt.context) || typeof opt.context === 'number') && opt.context !== '';
      const codes = opt.lngs ? opt.lngs : this.languageUtils.toResolveHierarchy(opt.lng || this.language, opt.fallbackLng);
      namespaces.forEach(ns => {
        if (this.isValidLookup(found)) return;
        usedNS = ns;
        if (!this.checkedLoadedFor[`${codes[0]}-${ns}`] && this.utils?.hasLoadedNamespace && !this.utils?.hasLoadedNamespace(usedNS)) {
          this.checkedLoadedFor[`${codes[0]}-${ns}`] = true;
          this.logger.warn(`key "${usedKey}" for languages "${codes.join(', ')}" won't get resolved as namespace "${usedNS}" was not yet loaded`, 'This means something IS WRONG in your setup. You access the t function before i18next.init / i18next.loadNamespace / i18next.changeLanguage was done. Wait for the callback or Promise to resolve before accessing it!!!');
        }
        codes.forEach(code => {
          if (this.isValidLookup(found)) return;
          usedLng = code;
          const finalKeys = [key];
          if (this.i18nFormat?.addLookupKeys) {
            this.i18nFormat.addLookupKeys(finalKeys, key, code, ns, opt);
          } else {
            let pluralSuffix;
            if (needsPluralHandling) pluralSuffix = this.pluralResolver.getSuffix(code, opt.count, opt);
            const zeroSuffix = `${this.options.pluralSeparator}zero`;
            const ordinalPrefix = `${this.options.pluralSeparator}ordinal${this.options.pluralSeparator}`;
            if (needsPluralHandling) {
              if (opt.ordinal && pluralSuffix.startsWith(ordinalPrefix)) {
                finalKeys.push(key + pluralSuffix.replace(ordinalPrefix, this.options.pluralSeparator));
              }
              finalKeys.push(key + pluralSuffix);
              if (needsZeroSuffixLookup) {
                finalKeys.push(key + zeroSuffix);
              }
            }
            if (needsContextHandling) {
              const contextKey = `${key}${this.options.contextSeparator || '_'}${opt.context}`;
              finalKeys.push(contextKey);
              if (needsPluralHandling) {
                if (opt.ordinal && pluralSuffix.startsWith(ordinalPrefix)) {
                  finalKeys.push(contextKey + pluralSuffix.replace(ordinalPrefix, this.options.pluralSeparator));
                }
                finalKeys.push(contextKey + pluralSuffix);
                if (needsZeroSuffixLookup) {
                  finalKeys.push(contextKey + zeroSuffix);
                }
              }
            }
          }
          let possibleKey;
          while (possibleKey = finalKeys.pop()) {
            if (!this.isValidLookup(found)) {
              exactUsedKey = possibleKey;
              found = this.getResource(code, ns, possibleKey, opt);
            }
          }
        });
      });
    });
    return {
      res: found,
      usedKey,
      exactUsedKey,
      usedLng,
      usedNS
    };
  }
  isValidLookup(res) {
    return res !== undefined && !(!this.options.returnNull && res === null) && !(!this.options.returnEmptyString && res === '');
  }
  getResource(code, ns, key, options = {}) {
    if (this.i18nFormat?.getResource) return this.i18nFormat.getResource(code, ns, key, options);
    return this.resourceStore.getResource(code, ns, key, options);
  }
  getUsedParamsDetails(options = {}) {
    const optionsKeys = ['defaultValue', 'ordinal', 'context', 'replace', 'lng', 'lngs', 'fallbackLng', 'ns', 'keySeparator', 'nsSeparator', 'returnObjects', 'returnDetails', 'joinArrays', 'postProcess', 'interpolation'];
    const useOptionsReplaceForData = options.replace && !isString(options.replace);
    let data = useOptionsReplaceForData ? options.replace : options;
    if (useOptionsReplaceForData && typeof options.count !== 'undefined') {
      data = {
        ...data,
        count: options.count
      };
    }
    if (this.options.interpolation.defaultVariables) {
      data = {
        ...this.options.interpolation.defaultVariables,
        ...data
      };
    }
    if (!useOptionsReplaceForData) {
      data = {
        ...data
      };
      for (const key of optionsKeys) {
        delete data[key];
      }
    }
    return data;
  }
  static hasDefaultValue(options) {
    const prefix = 'defaultValue';
    for (const option in options) {
      if (Object.prototype.hasOwnProperty.call(options, option) && option.startsWith(prefix) && undefined !== options[option]) {
        return true;
      }
    }
    return false;
  }
}

class LanguageUtil {
  constructor(options) {
    this.options = options;
    this.supportedLngs = this.options.supportedLngs || false;
    this.logger = baseLogger.create('languageUtils');
    this.resolveHierarchyCache = {};
  }
  clearCache() {
    this.resolveHierarchyCache = {};
  }
  getScriptPartFromCode(code) {
    code = getCleanedCode(code);
    if (!code || !code.includes('-')) return null;
    const p = code.split('-');
    if (p.length === 2) return null;
    p.pop();
    if (p[p.length - 1].toLowerCase() === 'x') return null;
    return this.formatLanguageCode(p.join('-'));
  }
  getLanguagePartFromCode(code) {
    code = getCleanedCode(code);
    if (!code || !code.includes('-')) return code;
    const p = code.split('-');
    return this.formatLanguageCode(p[0]);
  }
  formatLanguageCode(code) {
    if (isString(code) && code.includes('-')) {
      let formattedCode;
      try {
        formattedCode = Intl.getCanonicalLocales(code)[0];
      } catch (e) {}
      if (formattedCode && this.options.lowerCaseLng) {
        formattedCode = formattedCode.toLowerCase();
      }
      if (formattedCode) return formattedCode;
      if (this.options.lowerCaseLng) {
        return code.toLowerCase();
      }
      return code;
    }
    const formatted = this.options.cleanCode || this.options.lowerCaseLng ? code.toLowerCase() : code;
    if (this.logger.debug && isString(code)) this.deprecateBareCode(code, formatted);
    return formatted;
  }
  deprecateBareCode(code, formatted) {
    let canonical;
    try {
      canonical = Intl.getCanonicalLocales(code)[0];
    } catch (e) {
      return;
    }
    let v27 = canonical.toLowerCase() === code.toLowerCase() ? canonical : code.toLowerCase();
    if (this.options.lowerCaseLng) v27 = v27.toLowerCase();
    if (v27 === formatted) return;
    this.logger.once(code, 'deprecate', `language code '${code}' is used as '${formatted}'; i18next v27 gives it the canonical casing '${v27}', use '${v27}' in lng, fallbackLng, supportedLngs and the resources`);
  }
  isSupportedCode(code) {
    if (this.options.load === 'languageOnly' || this.options.nonExplicitSupportedLngs) {
      code = this.getLanguagePartFromCode(code);
    }
    return !this.supportedLngs || !this.supportedLngs.length || this.supportedLngs.includes(code);
  }
  getBestMatchFromCodes(codes) {
    if (!codes) return null;
    let found;
    codes.forEach(code => {
      if (found) return;
      const cleanedLng = this.formatLanguageCode(code);
      if (!this.options.supportedLngs || this.isSupportedCode(cleanedLng)) found = cleanedLng;
    });
    if (!found && this.options.supportedLngs) {
      codes.forEach(code => {
        if (found) return;
        const lngScOnly = this.getScriptPartFromCode(code);
        if (this.isSupportedCode(lngScOnly)) return found = lngScOnly;
        const lngOnly = this.getLanguagePartFromCode(code);
        if (this.isSupportedCode(lngOnly)) return found = lngOnly;
        found = this.options.supportedLngs.find(supportedLng => {
          if (supportedLng === lngOnly) return true;
          if (!supportedLng.includes('-') && !lngOnly.includes('-')) return false;
          if (supportedLng.includes('-') && !lngOnly.includes('-') && supportedLng.slice(0, supportedLng.indexOf('-')) === lngOnly) return true;
          return false;
        });
      });
    }
    if (!found) found = this.getFallbackCodes(this.options.fallbackLng)[0];
    return found;
  }
  getFallbackCodes(fallbacks, code) {
    if (!fallbacks) return [];
    if (typeof fallbacks === 'function') fallbacks = fallbacks(code);
    if (isString(fallbacks)) fallbacks = [fallbacks];
    if (Array.isArray(fallbacks)) return fallbacks;
    if (!code) return fallbacks.default || [];
    let found = fallbacks[code];
    if (!found) found = fallbacks[this.getScriptPartFromCode(code)];
    if (!found) found = fallbacks[this.formatLanguageCode(code)];
    if (!found) found = fallbacks[this.getLanguagePartFromCode(code)];
    if (!found) found = fallbacks.default;
    return found || [];
  }
  toResolveHierarchy(code, fallbackCode) {
    const fallbackLng = this.options.fallbackLng;
    const fallbackLngKey = Array.isArray(fallbackLng) ? fallbackLng.join('|') : fallbackLng;
    if (fallbackLngKey !== this._cachedFallbackLng) {
      this.resolveHierarchyCache = {};
      this._cachedFallbackLng = fallbackLngKey;
    }
    const hasCacheableFallback = fallbackCode === undefined || fallbackCode === false || isString(fallbackCode);
    const usesUncacheableOptionsFallback = fallbackCode === undefined && typeof this.options.fallbackLng === 'function';
    const cacheable = isString(code) && hasCacheableFallback && !usesUncacheableOptionsFallback;
    let cacheKey = null;
    if (cacheable) {
      let fallbackCacheKey;
      if (fallbackCode === undefined) fallbackCacheKey = 'undefined';else if (fallbackCode === false) fallbackCacheKey = 'boolean:false';else fallbackCacheKey = `string:${fallbackCode}`;
      cacheKey = `${code.length}:${code}|${fallbackCacheKey}`;
    }
    if (cacheKey !== null) {
      const cached = this.resolveHierarchyCache[cacheKey];
      if (cached !== undefined) return cached.slice();
    }
    const fallbackCodes = this.getFallbackCodes((fallbackCode === false ? [] : fallbackCode) || this.options.fallbackLng || [], code);
    const codes = [];
    const addCode = c => {
      if (!c) return;
      if (this.isSupportedCode(c)) {
        codes.push(c);
      } else {
        this.logger.warn(`rejecting language code not found in supportedLngs: ${c}`);
      }
    };
    if (isString(code) && (code.includes('-') || code.includes('_'))) {
      if (this.options.load !== 'languageOnly') addCode(this.formatLanguageCode(code));
      if (this.options.load !== 'languageOnly' && this.options.load !== 'currentOnly') addCode(this.getScriptPartFromCode(code));
      if (this.options.load !== 'currentOnly') addCode(this.getLanguagePartFromCode(code));
    } else if (isString(code)) {
      addCode(this.formatLanguageCode(code));
    }
    fallbackCodes.forEach(fc => {
      const formattedFc = this.formatLanguageCode(fc);
      if (!codes.includes(formattedFc)) addCode(formattedFc);
    });
    if (cacheKey !== null) {
      this.resolveHierarchyCache[cacheKey] = codes;
      return codes.slice();
    }
    return codes;
  }
}

const suffixesOrder = {
  zero: 0,
  one: 1,
  two: 2,
  few: 3,
  many: 4,
  other: 5
};
const dummyRule = {
  select: count => count === 1 ? 'one' : 'other',
  resolvedOptions: () => ({
    pluralCategories: ['one', 'other']
  })
};
class PluralResolver {
  constructor(languageUtils, options = {}) {
    this.languageUtils = languageUtils;
    this.options = options;
    this.logger = baseLogger.create('pluralResolver');
    this.pluralRulesCache = {};
  }
  clearCache() {
    this.pluralRulesCache = {};
  }
  getRule(code, options = {}) {
    const cleanedCode = getCleanedCode(code === 'dev' ? 'en' : code);
    const type = options.ordinal ? 'ordinal' : 'cardinal';
    const cacheKey = JSON.stringify({
      cleanedCode,
      type
    });
    if (cacheKey in this.pluralRulesCache) {
      return this.pluralRulesCache[cacheKey];
    }
    let rule;
    try {
      rule = new Intl.PluralRules(cleanedCode, {
        type
      });
    } catch (err) {
      if (typeof Intl === 'undefined') {
        this.logger.error('No Intl support, please use an Intl polyfill!');
        return dummyRule;
      }
      if (!code.match(/-|_/)) return dummyRule;
      const lngPart = this.languageUtils.getLanguagePartFromCode(code);
      rule = this.getRule(lngPart, options);
    }
    this.pluralRulesCache[cacheKey] = rule;
    return rule;
  }
  needsPlural(code, options = {}) {
    let rule = this.getRule(code, options);
    if (!rule) rule = this.getRule('dev', options);
    return rule?.resolvedOptions().pluralCategories.length > 1;
  }
  getPluralFormsOfKey(code, key, options = {}) {
    return this.getSuffixes(code, options).map(suffix => `${key}${suffix}`);
  }
  getSuffixes(code, options = {}) {
    let rule = this.getRule(code, options);
    if (!rule) rule = this.getRule('dev', options);
    if (!rule) return [];
    return rule.resolvedOptions().pluralCategories.sort((pluralCategory1, pluralCategory2) => suffixesOrder[pluralCategory1] - suffixesOrder[pluralCategory2]).map(pluralCategory => `${this.options.prepend}${options.ordinal ? `ordinal${this.options.prepend}` : ''}${pluralCategory}`);
  }
  getSuffix(code, count, options = {}) {
    const rule = this.getRule(code, options);
    if (rule) {
      return `${this.options.prepend}${options.ordinal ? `ordinal${this.options.prepend}` : ''}${rule.select(count)}`;
    }
    this.logger.warn(`no plural rule found for: ${code}`);
    return this.getSuffix('dev', count, options);
  }
}

const deepFindWithDefaults = (data, defaultData, key, keySeparator = '.', ignoreJSONStructure = true) => {
  let path = getPathWithDefaults(data, defaultData, key);
  if (path == null && ignoreJSONStructure && isString(key)) {
    path = deepFind(data, key, keySeparator);
    if (path === undefined) path = deepFind(defaultData, key, keySeparator);
  }
  return path;
};
class Interpolator {
  constructor(options = {}) {
    this.logger = baseLogger.create('interpolator');
    this.options = options;
    this.format = options?.interpolation?.format || (value => value);
    this.init(options);
  }
  init(options = {}) {
    if (!options.interpolation) options.interpolation = {
      escapeValue: true
    };
    const {
      escape: escape$1,
      escapeValue,
      useRawValueToEscape,
      prefix,
      prefixEscaped,
      suffix,
      suffixEscaped,
      formatSeparator,
      unescapeSuffix,
      unescapePrefix,
      nestingPrefix,
      nestingPrefixEscaped,
      nestingSuffix,
      nestingSuffixEscaped,
      nestingOptionsSeparator,
      maxReplaces,
      alwaysFormat
    } = options.interpolation;
    if (prefixEscaped || suffixEscaped || nestingPrefixEscaped || nestingSuffixEscaped) {
      const names = Object.entries({
        prefixEscaped,
        suffixEscaped,
        nestingPrefixEscaped,
        nestingSuffixEscaped
      }).filter(([, v]) => v).map(([k]) => k);
      this.logger.once(names.join(), 'deprecate', `interpolation.${names.join(', interpolation.')}: the regex-escaped delimiter options are removed in v27; pass the literal delimiters as prefix, suffix, nestingPrefix and nestingSuffix`);
    }
    this.escape = escape$1 !== undefined ? escape$1 : escape;
    this.escapeValue = escapeValue !== undefined ? escapeValue : true;
    this.useRawValueToEscape = useRawValueToEscape !== undefined ? useRawValueToEscape : false;
    this.prefix = prefix ? regexEscape(prefix) : prefixEscaped || '{{';
    this.suffix = suffix ? regexEscape(suffix) : suffixEscaped || '}}';
    this.formatSeparator = formatSeparator || ',';
    this.unescapePrefix = unescapeSuffix ? '' : unescapePrefix ? regexEscape(unescapePrefix) : '-';
    this.unescapeSuffix = this.unescapePrefix ? '' : unescapeSuffix ? regexEscape(unescapeSuffix) : '';
    this.nestingPrefix = nestingPrefix ? regexEscape(nestingPrefix) : nestingPrefixEscaped || regexEscape('$t(');
    this.nestingSuffix = nestingSuffix ? regexEscape(nestingSuffix) : nestingSuffixEscaped || regexEscape(')');
    this.nestingOptionsSeparator = nestingOptionsSeparator || ',';
    this.maxReplaces = maxReplaces || 1000;
    this.alwaysFormat = alwaysFormat !== undefined ? alwaysFormat : false;
    this.resetRegExp();
  }
  reset() {
    if (this.options) this.init(this.options);
  }
  resetRegExp() {
    const getOrResetRegExp = (existingRegExp, pattern) => {
      if (existingRegExp?.source === pattern) {
        existingRegExp.lastIndex = 0;
        return existingRegExp;
      }
      return new RegExp(pattern, 'g');
    };
    this.regexp = getOrResetRegExp(this.regexp, `${this.prefix}(.+?)${this.suffix}`);
    this.regexpUnescape = getOrResetRegExp(this.regexpUnescape, `${this.prefix}${this.unescapePrefix}(.+?)${this.unescapeSuffix}${this.suffix}`);
    this.nestingRegexp = getOrResetRegExp(this.nestingRegexp, `${this.nestingPrefix}((?:[^()"']|"[^"]*"|'[^']*'|\\((?:[^()"']|"[^"]*"|'[^']*')*\\))*?)${this.nestingSuffix}`);
  }
  interpolate(str, data, lng, options) {
    let match;
    let value;
    let replaces;
    const original = str;
    const defaultData = this.options && this.options.interpolation && this.options.interpolation.defaultVariables || {};
    const handleFormat = key => {
      if (!key.includes(this.formatSeparator)) {
        const path = deepFindWithDefaults(data, defaultData, key, this.options.keySeparator, this.options.ignoreJSONStructure);
        return this.alwaysFormat ? this.format(path, undefined, lng, {
          ...options,
          ...data,
          interpolationkey: key
        }) : path;
      }
      const p = key.split(this.formatSeparator);
      const k = p.shift().trim();
      const f = p.join(this.formatSeparator).trim();
      return this.format(deepFindWithDefaults(data, defaultData, k, this.options.keySeparator, this.options.ignoreJSONStructure), f, lng, {
        ...options,
        ...data,
        interpolationkey: k
      });
    };
    this.resetRegExp();
    if (!this.escapeValue && typeof str === 'string' && /\$t\([^)]*\{[^}]*\{\{/.test(str)) {
      this.logger.warn('nesting options string contains interpolated variables with escapeValue: false — ' + 'if any of those values are attacker-controlled they can inject additional ' + 'nesting options (e.g. redirect lng/ns). Sanitise untrusted input before passing ' + 'it to t(), or keep escapeValue: true.');
    }
    const missingInterpolationHandler = options?.missingInterpolationHandler || this.options.missingInterpolationHandler;
    const skipOnVariables = options?.interpolation?.skipOnVariables !== undefined ? options.interpolation.skipOnVariables : this.options.interpolation.skipOnVariables;
    const todos = [{
      regex: this.regexpUnescape,
      safeValue: val => val
    }, {
      regex: this.regexp,
      safeValue: val => {
        if (!this.escapeValue) return val;
        if (this.escape === escape && this.options?.interpolation?.escapeValue !== false && isString(val) && val.includes('/')) {
          this.logger.once('/', 'deprecate', "escapeValue renders '/' in a value as '&#x2F;' today; from v27 the default escape leaves '/' as it is");
        }
        return this.escape(val);
      }
    }];
    const unescapedValues = [];
    let shift = 0;
    todos.forEach(todo => {
      replaces = 0;
      while (match = todo.regex.exec(str)) {
        const at = match.index - shift;
        const written = unescapedValues.find(([start, end]) => at >= start && at < end);
        if (written) {
          todo.regex.lastIndex = written[1] + shift;
          continue;
        }
        const matchedVar = match[1].trim();
        value = handleFormat(matchedVar);
        if (value === undefined) {
          if (typeof missingInterpolationHandler === 'function') {
            const temp = missingInterpolationHandler(str, match, options);
            value = isString(temp) ? temp : '';
          } else if (options && Object.prototype.hasOwnProperty.call(options, matchedVar)) {
            value = '';
          } else if (skipOnVariables) {
            if (this.logger.debug) {
              this.logger.once(`${original}\u0000${match[0]}`, 'warn', `missed to pass in variable ${matchedVar} for interpolating ${original}`);
            }
            value = match[0];
            continue;
          } else {
            this.logger.warn(`missed to pass in variable ${matchedVar} for interpolating ${str}`);
            value = '';
          }
        } else if (!isString(value) && !this.useRawValueToEscape) {
          value = makeString(value);
        }
        const safeValue = makeString(todo.safeValue(value));
        str = str.slice(0, match.index) + safeValue + str.slice(match.index + match[0].length);
        if (skipOnVariables) {
          if (todo.regex === this.regexpUnescape) {
            unescapedValues.push([match.index, match.index + safeValue.length]);
          } else {
            shift += safeValue.length - match[0].length;
          }
          todo.regex.lastIndex += safeValue.length;
          todo.regex.lastIndex -= match[0].length;
        } else {
          todo.regex.lastIndex = 0;
        }
        replaces++;
        if (replaces >= this.maxReplaces) {
          break;
        }
      }
    });
    return str;
  }
  nest(str, fc, options = {}) {
    let match;
    let value;
    let clonedOptions;
    const handleHasOptions = (key, inheritedOptions) => {
      const sep = this.nestingOptionsSeparator;
      if (!key.includes(sep)) return key;
      const c = key.split(new RegExp(`${regexEscape(sep)}[ ]*{`));
      let optionsString = `{${c[1]}`;
      key = c[0];
      optionsString = this.interpolate(optionsString, clonedOptions);
      const matchedSingleQuotes = optionsString.match(/'/g);
      const matchedDoubleQuotes = optionsString.match(/"/g);
      if ((matchedSingleQuotes?.length ?? 0) % 2 === 0 && !matchedDoubleQuotes || (matchedDoubleQuotes?.length ?? 0) % 2 !== 0) {
        optionsString = optionsString.replace(/'/g, '"');
      }
      try {
        clonedOptions = JSON.parse(optionsString);
        if (inheritedOptions) clonedOptions = {
          ...inheritedOptions,
          ...clonedOptions
        };
      } catch (e) {
        this.logger.warn(`failed parsing options string in nesting for key ${key}`, e);
        return `${key}${sep}${optionsString}`;
      }
      if (clonedOptions.defaultValue && clonedOptions.defaultValue.includes(this.prefix)) delete clonedOptions.defaultValue;
      return key;
    };
    const nestingRegexp = new RegExp(this.nestingRegexp);
    let out = '';
    let lastEnd = 0;
    while (match = nestingRegexp.exec(str)) {
      let formatters = [];
      clonedOptions = {
        ...options
      };
      clonedOptions = clonedOptions.replace && !isString(clonedOptions.replace) ? clonedOptions.replace : clonedOptions;
      clonedOptions.applyPostProcessor = false;
      delete clonedOptions.defaultValue;
      const keyEndIndex = /{.*}/s.test(match[1]) ? match[1].lastIndexOf('}') + 1 : match[1].indexOf(this.formatSeparator);
      if (keyEndIndex !== -1) {
        formatters = match[1].slice(keyEndIndex).split(this.formatSeparator).map(elem => elem.trim()).filter(Boolean);
        match[1] = match[1].slice(0, keyEndIndex);
      }
      value = fc(handleHasOptions.call(this, match[1].trim(), clonedOptions), clonedOptions);
      if (value && match[0] === str && !isString(value)) return value;
      if (!isString(value)) value = makeString(value);
      if (!value) {
        this.logger.warn(`missed to resolve ${match[1]} for nesting ${str}`);
        value = '';
      }
      if (formatters.length) {
        value = formatters.reduce((v, f) => this.format(v, f, options.lng, {
          ...options,
          interpolationkey: match[1].trim()
        }), value.trim());
      }
      out += str.slice(lastEnd, match.index) + makeString(value);
      lastEnd = nestingRegexp.lastIndex;
      this.regexp.lastIndex = 0;
    }
    return lastEnd ? out + str.slice(lastEnd) : str;
  }
}

const parseFormatStr = formatStr => {
  let formatName = formatStr.toLowerCase().trim();
  const formatOptions = {};
  if (formatStr.includes('(')) {
    const p = formatStr.split('(');
    formatName = p[0].toLowerCase().trim();
    const optStr = p[1].slice(0, -1);
    if (formatName === 'currency' && !optStr.includes(':')) {
      if (!formatOptions.currency) formatOptions.currency = optStr.trim();
    } else if (formatName === 'relativetime' && !optStr.includes(':')) {
      if (!formatOptions.range) formatOptions.range = optStr.trim();
    } else {
      const opts = optStr.split(';');
      opts.forEach(opt => {
        if (opt) {
          const [key, ...rest] = opt.split(':');
          const val = rest.join(':').trim().replace(/^'+|'+$/g, '');
          const trimmedKey = key.trim();
          if (!formatOptions[trimmedKey]) formatOptions[trimmedKey] = val;
          if (val === 'false') formatOptions[trimmedKey] = false;
          if (val === 'true') formatOptions[trimmedKey] = true;
          if (!isNaN(val)) formatOptions[trimmedKey] = parseInt(val, 10);
        }
      });
    }
  }
  return {
    formatName,
    formatOptions
  };
};
const createCachedFormatter = fn => {
  const cache = {};
  return (v, l, o) => {
    let optForCache = o;
    if (o && o.interpolationkey && o.formatParams && o.formatParams[o.interpolationkey] && o[o.interpolationkey]) {
      optForCache = {
        ...optForCache,
        [o.interpolationkey]: undefined
      };
    }
    let key;
    try {
      key = l + JSON.stringify(optForCache);
    } catch (e) {
      return fn(getCleanedCode(l), o)(v);
    }
    let frm = cache[key];
    if (!frm) {
      frm = fn(getCleanedCode(l), o);
      cache[key] = frm;
    }
    return frm(v);
  };
};
const createNonCachedFormatter = fn => (v, l, o) => fn(getCleanedCode(l), o)(v);
class Formatter {
  constructor(options = {}) {
    this.logger = baseLogger.create('formatter');
    this.options = options;
    this.init(options);
  }
  init(services, options = {
    interpolation: {}
  }) {
    this.formatSeparator = options.interpolation.formatSeparator || ',';
    const cf = options.cacheInBuiltFormats ? createCachedFormatter : createNonCachedFormatter;
    this.formats = {
      number: cf((lng, opt) => {
        const formatter = new Intl.NumberFormat(lng, {
          ...opt
        });
        return val => formatter.format(val);
      }),
      currency: cf((lng, opt) => {
        const formatter = new Intl.NumberFormat(lng, {
          ...opt,
          style: 'currency'
        });
        return val => formatter.format(val);
      }),
      datetime: cf((lng, opt) => {
        const formatter = new Intl.DateTimeFormat(lng, {
          ...opt
        });
        return val => formatter.format(val);
      }),
      relativetime: cf((lng, opt) => {
        const formatter = new Intl.RelativeTimeFormat(lng, {
          ...opt
        });
        return val => formatter.format(val, opt.range || 'day');
      }),
      list: cf((lng, opt) => {
        const formatter = new Intl.ListFormat(lng, {
          ...opt
        });
        return val => formatter.format(val);
      })
    };
  }
  add(name, fc) {
    this.formats[name.toLowerCase().trim()] = fc;
  }
  addCached(name, fc) {
    this.formats[name.toLowerCase().trim()] = createCachedFormatter(fc);
  }
  format(value, format, lng, options = {}) {
    if (!format) return value;
    if (value == null) return value;
    const rawFormats = format.split(this.formatSeparator);
    const formats = [];
    for (let i = 0; i < rawFormats.length; i++) {
      let f = rawFormats[i];
      while (f.indexOf('(') > -1 && !f.includes(')') && i + 1 < rawFormats.length) {
        f = `${f}${this.formatSeparator}${rawFormats[++i]}`;
      }
      formats.push(f);
    }
    const result = formats.reduce((mem, f) => {
      const {
        formatName,
        formatOptions
      } = parseFormatStr(f);
      if (this.formats[formatName]) {
        let formatted = mem;
        try {
          const valOptions = options?.formatParams?.[options.interpolationkey] || {};
          const l = valOptions.locale || valOptions.lng || options.locale || options.lng || lng;
          formatted = this.formats[formatName](mem, l, {
            ...formatOptions,
            ...options,
            ...valOptions
          });
        } catch (error) {
          this.logger.warn(error);
        }
        return formatted;
      } else {
        this.logger.warn(`there was no format function for ${formatName}`);
      }
      return mem;
    }, value);
    return result;
  }
}

const removePending = (q, name) => {
  if (q.pending[name] !== undefined) {
    delete q.pending[name];
    q.pendingCount--;
  }
};
class Connector extends EventEmitter {
  constructor(backend, store, services, options = {}) {
    super();
    this.backend = backend;
    this.store = store;
    this.services = services;
    this.languageUtils = services.languageUtils;
    this.options = options;
    this.logger = baseLogger.create('backendConnector');
    this.waitingReads = [];
    this.maxParallelReads = options.maxParallelReads || 10;
    this.readingCalls = 0;
    this.maxRetries = options.maxRetries >= 0 ? options.maxRetries : 5;
    this.retryTimeout = options.retryTimeout >= 1 ? options.retryTimeout : 350;
    this.state = {};
    this.queue = [];
    this.backend?.init?.(services, options.backend, options);
    this.callbackApi = callbackApiOf(this.backend);
    if (this.backend && this.callbackApi === undefined && (this.backend.read || this.backend.create)) {
      this.logger.deprecate('backend: set callbackApi to declare the calling convention (true: read(language, namespace, callback) and create(languages, namespace, key, fallbackValue, callback, options); false: both return a promise or a value); guessing it from the number of parameters is deprecated');
    }
  }
  queueLoad(languages, namespaces, options, callback) {
    const toLoad = {};
    const pending = {};
    const toLoadLanguages = {};
    const toLoadNamespaces = {};
    languages.forEach(lng => {
      let hasAllNamespaces = true;
      namespaces.forEach(ns => {
        const name = `${lng}|${ns}`;
        if (!options.reload && this.store.hasResourceBundle(lng, ns)) {
          this.state[name] = 2;
        } else if (!options.reload && this.state[name] < 0) ; else if (this.state[name] === 1) {
          if (pending[name] === undefined) pending[name] = true;
        } else {
          this.state[name] = 1;
          hasAllNamespaces = false;
          if (pending[name] === undefined) pending[name] = true;
          if (toLoad[name] === undefined) toLoad[name] = true;
          if (toLoadNamespaces[ns] === undefined) toLoadNamespaces[ns] = true;
        }
      });
      if (!hasAllNamespaces) toLoadLanguages[lng] = true;
    });
    if (Object.keys(toLoad).length || Object.keys(pending).length) {
      this.queue.push({
        pending,
        pendingCount: Object.keys(pending).length,
        loaded: {},
        errors: [],
        callback
      });
    }
    return {
      toLoad: Object.keys(toLoad),
      pending: Object.keys(pending),
      toLoadLanguages: Object.keys(toLoadLanguages),
      toLoadNamespaces: Object.keys(toLoadNamespaces)
    };
  }
  loaded(name, err, data) {
    const s = name.split('|');
    const lng = s[0];
    const ns = s[1];
    if (err) this.emit('failedLoading', lng, ns, err);
    if (!err && data) {
      this.store.addResourceBundle(lng, ns, data, undefined, undefined, {
        skipCopy: true
      });
    }
    this.state[name] = err ? -1 : 2;
    if (err && data) this.state[name] = 0;
    const loaded = {};
    this.queue.forEach(q => {
      pushPath(q.loaded, [lng], ns);
      removePending(q, name);
      if (err) q.errors.push(err);
      if (q.pendingCount === 0 && !q.done) {
        Object.keys(q.loaded).forEach(l => {
          if (!loaded[l]) loaded[l] = {};
          const loadedKeys = q.loaded[l];
          if (loadedKeys.length) {
            loadedKeys.forEach(n => {
              if (loaded[l][n] === undefined) loaded[l][n] = true;
            });
          }
        });
        q.done = true;
        if (q.errors.length) {
          q.callback(q.errors);
        } else {
          q.callback();
        }
      }
    });
    this.emit('loaded', loaded);
    this.queue = this.queue.filter(q => !q.done);
  }
  read(lng, ns, fcName, tried = 0, wait = this.retryTimeout, callback) {
    if (!lng.length) return callback(null, {});
    if (this.readingCalls >= this.maxParallelReads) {
      this.waitingReads.push({
        lng,
        ns,
        fcName,
        tried,
        wait,
        callback
      });
      return;
    }
    this.readingCalls++;
    const resolver = (err, data) => {
      this.readingCalls--;
      if (this.waitingReads.length > 0) {
        const next = this.waitingReads.shift();
        this.read(next.lng, next.ns, next.fcName, next.tried, next.wait, next.callback);
      }
      if (err && data && tried < this.maxRetries) {
        setTimeout(() => {
          this.read(lng, ns, fcName, tried + 1, wait * 2, callback);
        }, wait);
        return;
      }
      callback(err, data);
    };
    const fc = this.backend[fcName].bind(this.backend);
    if (this.callbackApi === false || this.callbackApi === undefined && fc.length === 2) {
      try {
        const r = fc(lng, ns);
        if (r && typeof r.then === 'function') {
          r.then(data => resolver(null, data)).catch(resolver);
        } else {
          resolver(null, r);
        }
      } catch (err) {
        resolver(err);
      }
      return;
    }
    return fc(lng, ns, resolver);
  }
  prepareLoading(languages, namespaces, options = {}, callback) {
    if (!this.backend) {
      this.logger.warn('No backend was added via i18next.use. Will not load resources.');
      return callback && callback();
    }
    if (isString(languages)) languages = this.languageUtils.toResolveHierarchy(languages);
    if (isString(namespaces)) namespaces = [namespaces];
    const toLoad = this.queueLoad(languages, namespaces, options, callback);
    if (!toLoad.toLoad.length) {
      if (!toLoad.pending.length) callback();
      return null;
    }
    toLoad.toLoad.forEach(name => {
      this.loadOne(name);
    });
  }
  load(languages, namespaces, callback) {
    this.prepareLoading(languages, namespaces, {}, callback);
  }
  reload(languages, namespaces, callback) {
    this.prepareLoading(languages, namespaces, {
      reload: true
    }, callback);
  }
  noticeDevFallback(lng) {
    if (lng !== 'dev' || !this.devIsDefaultFallback) return;
    this.logger.once('dev', 'warn', "language 'dev' is requested because fallbackLng is not set (its default is ['dev']); i18next v27 defaults to fallbackLng: false and loads and saves missing keys in the requested language instead. Set fallbackLng to your source language, or to 'dev' to keep this behavior");
  }
  loadOne(name, prefix = '') {
    const s = name.split('|');
    const lng = s[0];
    const ns = s[1];
    this.noticeDevFallback(lng);
    this.read(lng, ns, 'read', undefined, undefined, (err, data) => {
      if (err) this.logger.warn(`${prefix}loading namespace ${ns} for language ${lng} failed`, err);
      if (!err && data) this.logger.log(`${prefix}loaded namespace ${ns} for language ${lng}`, data);
      this.loaded(name, err, data);
    });
  }
  saveMissing(languages, namespace, key, fallbackValue, isUpdate, options = {}, clb = () => {}, hasLoadedNamespace = this.newestCloneHasLoadedNamespace || this.services?.utils?.hasLoadedNamespace) {
    if (hasLoadedNamespace && !hasLoadedNamespace(namespace)) {
      this.logger.warn(`did not save key "${key}" as the namespace "${namespace}" was not yet loaded`, 'This means something IS WRONG in your setup. You access the t function before i18next.init / i18next.loadNamespace / i18next.changeLanguage was done. Wait for the callback or Promise to resolve before accessing it!!!');
      return;
    }
    if (key === undefined || key === null || key === '') return;
    if (this.backend?.create) {
      languages?.forEach?.(l => this.noticeDevFallback(l));
      const opts = {
        ...options,
        isUpdate
      };
      const fc = this.backend.create.bind(this.backend);
      if (this.callbackApi === false || this.callbackApi === undefined && fc.length < 6) {
        try {
          let r;
          if (this.callbackApi === false || fc.length === 5) {
            r = fc(languages, namespace, key, fallbackValue, opts);
          } else {
            r = fc(languages, namespace, key, fallbackValue);
          }
          if (r && typeof r.then === 'function') {
            r.then(data => clb(null, data)).catch(clb);
          } else {
            clb(null, r);
          }
        } catch (err) {
          clb(err);
        }
      } else {
        fc(languages, namespace, key, fallbackValue, clb, opts);
      }
    }
    if (!languages || !languages[0]) return;
    this.store.addResource(languages[0], namespace, key, fallbackValue);
  }
}

const get = () => ({
  debug: false,
  initAsync: true,
  ns: ['translation'],
  defaultNS: ['translation'],
  fallbackLng: ['dev'],
  fallbackNS: false,
  supportedLngs: false,
  nonExplicitSupportedLngs: false,
  load: 'all',
  preload: false,
  keySeparator: '.',
  nsSeparator: ':',
  pluralSeparator: '_',
  contextSeparator: '_',
  enableSelector: false,
  partialBundledLanguages: false,
  saveMissing: false,
  updateMissing: false,
  saveMissingTo: 'fallback',
  saveMissingPlurals: true,
  missingKeyHandler: false,
  missingInterpolationHandler: false,
  postProcess: false,
  postProcessPassResolved: false,
  returnNull: false,
  returnEmptyString: true,
  returnObjects: false,
  joinArrays: false,
  returnedObjectHandler: false,
  parseMissingKeyHandler: false,
  appendNamespaceToMissingKey: false,
  appendNamespaceToCIMode: false,
  overloadTranslationOptionHandler: args => {
    let ret = {};
    if (typeof args[1] === 'object') ret = args[1];
    if (isString(args[1])) ret.defaultValue = args[1];
    if (isString(args[2])) ret.tDescription = args[2];
    if (typeof args[2] === 'object' || typeof args[3] === 'object') {
      const options = args[3] || args[2];
      Object.keys(options).forEach(key => {
        ret[key] = options[key];
      });
    }
    return ret;
  },
  interpolation: {
    escapeValue: true,
    prefix: '{{',
    suffix: '}}',
    formatSeparator: ',',
    unescapePrefix: '-',
    nestingPrefix: '$t(',
    nestingSuffix: ')',
    nestingOptionsSeparator: ',',
    maxReplaces: 1000,
    skipOnVariables: true
  },
  cacheInBuiltFormats: true
});
const transformOptions = options => {
  if (isString(options.ns)) options.ns = [options.ns];
  if (isString(options.fallbackLng)) options.fallbackLng = [options.fallbackLng];
  if (isString(options.fallbackNS)) options.fallbackNS = [options.fallbackNS];
  if (options.supportedLngs && !options.supportedLngs.includes('cimode')) {
    options.supportedLngs = options.supportedLngs.concat(['cimode']);
  }
  return options;
};

const noop = () => {};
let loggerOwner;
const bindMemberFunctions = inst => {
  const mems = Object.getOwnPropertyNames(Object.getPrototypeOf(inst));
  mems.forEach(mem => {
    if (typeof inst[mem] === 'function') {
      inst[mem] = inst[mem].bind(inst);
    }
  });
};
class I18n extends EventEmitter {
  constructor(options = {}, callback) {
    super();
    this.options = transformOptions(options);
    this.services = {
      ownPostProcessors: new Set()
    };
    this.logger = baseLogger;
    this.modules = {
      external: []
    };
    bindMemberFunctions(this);
    if (callback && !this.isInitialized && !options.isClone) {
      if (!this.options.initAsync) {
        this.init(options, callback);
        return this;
      }
      setTimeout(() => {
        this.init(options, callback);
      }, 0);
    }
  }
  init(options = {}, callback) {
    this.isInitializing = true;
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    if (options.defaultNS == null && options.ns) {
      if (isString(options.ns)) {
        options.defaultNS = options.ns;
      } else if (!options.ns.includes('translation')) {
        options.defaultNS = options.ns[0];
      }
    }
    const fallbackLngIsDefault = options.fallbackLng === undefined && this.options.fallbackLng === undefined;
    const defOpts = get();
    this.options = {
      ...defOpts,
      ...this.options,
      ...transformOptions(options)
    };
    this.options.interpolation = {
      ...defOpts.interpolation,
      ...this.options.interpolation
    };
    if (options.keySeparator !== undefined) {
      this.options.userDefinedKeySeparator = options.keySeparator;
    }
    if (options.nsSeparator !== undefined) {
      this.options.userDefinedNsSeparator = options.nsSeparator;
    }
    if (typeof this.options.overloadTranslationOptionHandler !== 'function') {
      this.options.overloadTranslationOptionHandler = defOpts.overloadTranslationOptionHandler;
    }
    const createClassOnDemand = ClassOrObject => {
      if (!ClassOrObject) return null;
      if (typeof ClassOrObject === 'function') return new ClassOrObject();
      return ClassOrObject;
    };
    if (!this.options.isClone) {
      if (loggerOwner && loggerOwner !== this && loggerOwner.modules.logger !== this.modules.logger) {
        baseLogger.deprecate('init: this init() replaces the logger another i18next instance set with use(), as the logger is shared in v26; from v27 each instance keeps its own logger');
      }
      loggerOwner = this.modules.logger ? this : undefined;
      if (this.modules.logger) {
        baseLogger.init(createClassOnDemand(this.modules.logger), this.options);
      } else {
        baseLogger.init(null, this.options);
      }
      this.pendingWarnings?.forEach(msg => this.logger.warn(msg));
      this.pendingWarnings = undefined;
      let formatter;
      if (this.modules.formatter) {
        formatter = this.modules.formatter;
      } else {
        formatter = Formatter;
      }
      const lu = new LanguageUtil(this.options);
      this.store = new ResourceStore(this.options.resources, this.options);
      const s = this.services;
      s.logger = baseLogger;
      s.resourceStore = this.store;
      s.languageUtils = lu;
      s.pluralResolver = new PluralResolver(lu, {
        prepend: this.options.pluralSeparator
      });
      if (formatter) {
        s.formatter = createClassOnDemand(formatter);
        if (s.formatter.init) s.formatter.init(s, this.options);
        this.options.interpolation.format = s.formatter.format.bind(s.formatter);
      }
      s.interpolator = new Interpolator(this.options);
      s.utils = {
        hasLoadedNamespace: this.hasLoadedNamespace.bind(this),
        reloadResources: this.reloadResources.bind(this)
      };
      s.backendConnector = new Connector(createClassOnDemand(this.modules.backend), s.resourceStore, s, this.options);
      s.backendConnector.devIsDefaultFallback = fallbackLngIsDefault;
      s.backendConnector.on('*', (event, ...args) => {
        this.emit(event, ...args);
      });
      if (this.modules.languageDetector) {
        s.languageDetector = createClassOnDemand(this.modules.languageDetector);
        if (s.languageDetector.init) s.languageDetector.init(s, this.options.detection, this.options);
        if (s.languageDetector.async && callbackApiOf(s.languageDetector) === undefined) {
          this.logger.deprecate('languageDetector: set callbackApi to declare how the async detect() answers (true: detect(callback); false: detect() returns a promise); guessing it from the number of parameters is deprecated');
        }
      }
      if (this.modules.i18nFormat) {
        s.i18nFormat = createClassOnDemand(this.modules.i18nFormat);
        if (s.i18nFormat.init) s.i18nFormat.init(this);
      }
      this.translator = new Translator(this.services, this.options);
      this.translator.on('*', (event, ...args) => {
        this.emit(event, ...args);
      });
      this.modules.external.forEach(m => {
        if (m.init) m.init(this);
      });
    }
    this.format = this.options.interpolation.format;
    if (!callback) callback = noop;
    if (this.options.fallbackLng && !this.services.languageDetector && !this.options.lng) {
      const codes = this.services.languageUtils.getFallbackCodes(this.options.fallbackLng);
      if (codes.length > 0 && codes[0] !== 'dev') this.options.lng = codes[0];
    }
    if (!this.services.languageDetector && !this.options.lng) {
      this.logger.warn('init: no languageDetector is used and no lng is defined');
    }
    const storeApi = ['getResource', 'hasResourceBundle', 'getResourceBundle', 'getDataByLanguage'];
    storeApi.forEach(fcName => {
      this[fcName] = (...args) => this.store[fcName](...args);
    });
    const storeApiChained = ['addResource', 'addResources', 'addResourceBundle', 'removeResourceBundle'];
    storeApiChained.forEach(fcName => {
      this[fcName] = (...args) => {
        this.store[fcName](...args);
        return this;
      };
    });
    const deferred = defer();
    const load = () => {
      const finish = (err, t) => {
        this.isInitializing = false;
        if (this.isInitialized && !this.initializedStoreOnce) this.logger.warn('init: i18next is already initialized. You should call init just once!');
        this.isInitialized = true;
        if (!this.options.isClone) this.logger.log('initialized', this.options);
        this.emit('initialized', this.options);
        deferred.resolve(t);
        callback(err, t);
      };
      if ((this.languages || this.isLanguageChangingTo) && !this.isInitialized) return finish(null, this.t.bind(this));
      this.changeLanguage(this.options.lng, finish);
    };
    if (this.options.resources || !this.options.initAsync) {
      load();
    } else {
      setTimeout(load, 0);
    }
    return deferred;
  }
  loadResources(language, callback = noop) {
    let usedCallback = callback;
    const usedLng = isString(language) ? language : this.language;
    if (typeof language === 'function') usedCallback = language;
    if (!this.options.resources || this.options.partialBundledLanguages) {
      if (usedLng?.toLowerCase() === 'cimode' && (!this.options.preload || this.options.preload.length === 0)) return usedCallback();
      const toLoad = [];
      const append = lng => {
        if (!lng) return;
        if (lng === 'cimode') return;
        const lngs = this.services.languageUtils.toResolveHierarchy(lng);
        lngs.forEach(l => {
          if (l === 'cimode') return;
          if (!toLoad.includes(l)) toLoad.push(l);
        });
      };
      if (!usedLng) {
        const fallbacks = this.services.languageUtils.getFallbackCodes(this.options.fallbackLng);
        fallbacks.forEach(l => append(l));
      } else {
        append(usedLng);
      }
      this.options.preload?.forEach?.(l => append(l));
      this.services.backendConnector.load(toLoad, this.options.ns, e => {
        if (!e && !this.resolvedLanguage && this.language) this.setResolvedLanguage(this.language);
        usedCallback(e);
      });
    } else {
      usedCallback(null);
    }
  }
  reloadResources(lngs, ns, callback) {
    const deferred = defer();
    if (typeof lngs === 'function') {
      callback = lngs;
      lngs = undefined;
    }
    if (typeof ns === 'function') {
      callback = ns;
      ns = undefined;
    }
    if (!lngs) {
      const requested = Object.keys(this.services.backendConnector.state).map(name => name.split('|')[0]);
      lngs = [...new Set([...(this.languages || []), ...requested])].filter(l => l !== 'cimode');
    }
    if (!ns) ns = this.options.ns;
    if (!callback) callback = noop;
    this.services.backendConnector.reload(lngs, ns, err => {
      deferred.resolve();
      callback(err);
    });
    return deferred;
  }
  use(module) {
    if (!module) throw new Error('You are passing an undefined module! Please check the object you are passing to i18next.use()');
    if (!module.type) throw new Error('You are passing a wrong module! Please check the object you are passing to i18next.use()');
    const setModule = type => {
      if (this.modules[type] && this.modules[type] !== module) {
        const msg = `use: this ${type} replaces the ${type} passed to an earlier use() call; only one ${type} is used per instance`;
        if (this.isInitializing || this.isInitialized) this.logger.warn(msg);else (this.pendingWarnings = this.pendingWarnings || []).push(msg);
      }
      this.modules[type] = module;
    };
    if (module.type === 'backend') {
      setModule('backend');
    }
    if (module.type === 'logger' || module.log && module.warn && module.error) {
      this.modules.logger = module;
    }
    if (module.type === 'languageDetector') {
      setModule('languageDetector');
    }
    if (module.type === 'i18nFormat') {
      setModule('i18nFormat');
    }
    if (module.type === 'postProcessor') {
      postProcessor.addPostProcessor(module);
      this.services.ownPostProcessors?.add(module.name);
    }
    if (module.type === 'formatter') {
      setModule('formatter');
    }
    if (module.type === '3rdParty') {
      this.modules.external.push(module);
    }
    return this;
  }
  hydrate(resources, lng) {
    if (this.options.isClone) return this;
    if (!this.services.resourceStore) {
      this.logger.warn('hydrate: call init() first, the instance has no resource store yet');
      return this;
    }
    if (resources && !this.initializedStoreOnce) {
      this.services.resourceStore.data = resources;
      Object.values(resources).forEach(lngResources => {
        Object.keys(lngResources).forEach(ns => {
          if (!this.options.ns.includes(ns)) this.options.ns.push(ns);
        });
      });
      this.initializedStoreOnce = true;
      this.isInitialized = true;
    }
    if (lng && !this.initializedLanguageOnce) {
      this.changeLanguage(lng);
      this.initializedLanguageOnce = true;
    }
    return this;
  }
  setResolvedLanguage(l) {
    if (!l || !this.languages) return;
    if (['cimode', 'dev'].includes(l)) return;
    for (let li = 0; li < this.languages.length; li++) {
      const lngInLngs = this.languages[li];
      if (['cimode', 'dev'].includes(lngInLngs)) continue;
      if (this.store.hasLanguageSomeTranslations(lngInLngs)) {
        this.resolvedLanguage = lngInLngs;
        break;
      }
    }
    if (!this.resolvedLanguage && !this.languages.includes(l) && this.store.hasLanguageSomeTranslations(l)) {
      this.resolvedLanguage = l;
      this.languages.unshift(l);
    }
  }
  changeLanguage(lng, callback) {
    this.isLanguageChangingTo = lng;
    const deferred = defer();
    this.emit('languageChanging', lng);
    const setLngProps = l => {
      this.language = l;
      this.languages = this.services.languageUtils.toResolveHierarchy(l);
      this.resolvedLanguage = undefined;
      this.setResolvedLanguage(l);
    };
    const done = (err, l) => {
      if (l) {
        if (this.isLanguageChangingTo === lng) {
          setLngProps(l);
          this.translator.changeLanguage(l);
          this.isLanguageChangingTo = undefined;
          this.emit('languageChanged', l);
          this.logger.log('languageChanged', l);
        }
      } else {
        this.isLanguageChangingTo = undefined;
      }
      deferred.resolve((...args) => this.t(...args));
      if (callback) callback(err, (...args) => this.t(...args));
    };
    const setLng = lngs => {
      if (!lng && !lngs && this.services.languageDetector) lngs = [];
      const fl = isString(lngs) ? lngs : lngs && lngs[0];
      const l = this.store.hasLanguageSomeTranslations(fl) ? fl : this.services.languageUtils.getBestMatchFromCodes(isString(lngs) ? [lngs] : lngs);
      if (l && this.logger.debug && !isSafeLanguageCode(l)) {
        const configured = [].concat(this.options.supportedLngs || [], this.services.languageUtils.getFallbackCodes(this.options.fallbackLng, l), this.options.preload || []);
        if (!configured.includes(l) && !Object.prototype.hasOwnProperty.call(this.store.data, l)) {
          this.logger.once(`lng:${l}`, 'deprecate', `changeLanguage: the language code '${l.slice(0, 64)}' comes from lng, changeLanguage() or the language detector and is not configured; from v27 such a code is refused unless it has only letters, digits, '-', '_', '@' and '.' (no '..'), at most 128 characters. Set supportedLngs, or check the code before passing it on`);
        }
      }
      if (l) {
        if (!this.language) {
          setLngProps(l);
        }
        if (!this.translator.language) this.translator.changeLanguage(l);
        this.services.languageDetector?.cacheUserLanguage?.(l);
      }
      this.loadResources(l, err => {
        done(err, l);
      });
    };
    if (!lng && this.services.languageDetector && !this.services.languageDetector.async) {
      setLng(this.services.languageDetector.detect());
    } else if (!lng && this.services.languageDetector && this.services.languageDetector.async) {
      const callbackApi = callbackApiOf(this.services.languageDetector);
      if (callbackApi === false || callbackApi === undefined && this.services.languageDetector.detect.length === 0) {
        this.services.languageDetector.detect().then(setLng);
      } else {
        this.services.languageDetector.detect(setLng);
      }
    } else {
      setLng(lng);
    }
    return deferred;
  }
  getFixedT(lng, ns, keyPrefix, fixedOpts) {
    const scopeNs = fixedOpts?.scopeNs;
    const fixedT = (key, opts, ...rest) => {
      let o;
      if (typeof opts !== 'object') {
        o = this.options.overloadTranslationOptionHandler([key, opts].concat(rest));
      } else {
        o = {
          ...opts
        };
      }
      o.lng = o.lng || fixedT.lng;
      o.lngs = o.lngs || fixedT.lngs;
      const explicitCallNs = o.ns !== undefined && o.ns !== null;
      o.ns = o.ns || fixedT.ns;
      if (o.keyPrefix !== '') o.keyPrefix = o.keyPrefix || keyPrefix || fixedT.keyPrefix;
      const selectorOpts = {
        ...this.options,
        ...o
      };
      if (Array.isArray(scopeNs) && !explicitCallNs) selectorOpts.ns = scopeNs;
      if (typeof o.keyPrefix === 'function') o.keyPrefix = keysFromSelector(o.keyPrefix, selectorOpts);
      const keySeparator = this.options.keySeparator || '.';
      let resultKey;
      if (o.keyPrefix && Array.isArray(key)) {
        resultKey = key.map(k => {
          if (typeof k === 'function') k = keysFromSelector(k, selectorOpts);
          return `${o.keyPrefix}${keySeparator}${k}`;
        });
      } else {
        if (typeof key === 'function') key = keysFromSelector(key, selectorOpts);
        resultKey = o.keyPrefix ? `${o.keyPrefix}${keySeparator}${key}` : key;
      }
      return this.t(resultKey, o);
    };
    if (isString(lng)) {
      fixedT.lng = lng;
    } else {
      fixedT.lngs = lng;
    }
    fixedT.ns = ns;
    fixedT.keyPrefix = keyPrefix;
    return fixedT;
  }
  t(...args) {
    if (!this.translator) {
      this.logger.warn('t: called before init(); returning an empty string');
      return '';
    }
    return this.translator.translate(...args);
  }
  exists(...args) {
    return this.translator?.exists(...args);
  }
  setDefaultNamespace(ns) {
    this.options.defaultNS = ns;
  }
  hasLoadedNamespace(ns, options = {}) {
    if (!this.isInitialized) {
      this.logger.warn('hasLoadedNamespace: i18next was not initialized', this.languages);
      return false;
    }
    if (!this.languages || !this.languages.length) {
      this.logger.warn('hasLoadedNamespace: i18n.languages were undefined or empty', this.languages);
      return false;
    }
    const lng = options.lng || this.resolvedLanguage || this.languages[0];
    const fallbackLng = this.options ? this.options.fallbackLng : false;
    const lastLng = this.languages[this.languages.length - 1];
    if (lng.toLowerCase() === 'cimode') return true;
    const loadNotPending = (l, n) => {
      const loadState = this.services.backendConnector.state[`${l}|${n}`];
      return loadState === -1 || loadState === 0 || loadState === 2;
    };
    if (options.precheck) {
      const preResult = options.precheck(this, loadNotPending);
      if (preResult !== undefined) return preResult;
    }
    if (this.hasResourceBundle(lng, ns)) return true;
    if (!this.services.backendConnector.backend || this.options.resources && !this.options.partialBundledLanguages) return true;
    const {
      languageUtils
    } = this.services;
    const loadLng = !options.lng ? lng : languageUtils.isSupportedCode(lng) && languageUtils.toResolveHierarchy(lng, false)[0];
    if ((!loadLng || loadNotPending(loadLng, ns)) && (!fallbackLng || loadNotPending(lastLng, ns))) return true;
    return false;
  }
  loadNamespaces(ns, callback) {
    const deferred = defer();
    if (!this.options.ns) {
      if (callback) callback();
      return Promise.resolve();
    }
    if (isString(ns)) ns = [ns];
    ns.forEach(n => {
      if (!this.options.ns.includes(n)) this.options.ns.push(n);
    });
    this.loadResources(err => {
      deferred.resolve();
      if (callback) callback(err);
    });
    return deferred;
  }
  loadLanguages(lngs, callback) {
    const deferred = defer();
    if (isString(lngs)) lngs = [lngs];
    const preloaded = this.options.preload || [];
    const newLngs = lngs.filter(lng => !preloaded.includes(lng) && this.services.languageUtils.isSupportedCode(lng));
    if (!newLngs.length) {
      if (callback) callback();
      return Promise.resolve();
    }
    this.options.preload = preloaded.concat(newLngs);
    this.loadResources(err => {
      deferred.resolve();
      if (callback) callback(err);
    });
    return deferred;
  }
  dir(lng) {
    if (!lng) lng = this.resolvedLanguage || (this.languages?.length > 0 ? this.languages[0] : this.language);
    if (!lng) return 'ltr';
    try {
      const l = new Intl.Locale(lng);
      if (l && l.getTextInfo) {
        const ti = l.getTextInfo();
        if (ti && ti.direction) return ti.direction;
      }
    } catch (e) {}
    const rtlLngs = ['ar', 'shu', 'sqr', 'ssh', 'xaa', 'yhd', 'yud', 'aao', 'abh', 'abv', 'acm', 'acq', 'acw', 'acx', 'acy', 'adf', 'ads', 'aeb', 'aec', 'afb', 'ajp', 'apc', 'apd', 'arb', 'arq', 'ars', 'ary', 'arz', 'auz', 'avl', 'ayh', 'ayl', 'ayn', 'ayp', 'bbz', 'pga', 'he', 'iw', 'ps', 'pbt', 'pbu', 'pst', 'prp', 'prd', 'ug', 'ur', 'ydd', 'yds', 'yih', 'ji', 'yi', 'hbo', 'men', 'xmn', 'fa', 'jpr', 'peo', 'pes', 'prs', 'dv', 'sam', 'ckb'];
    const languageUtils = this.services?.languageUtils || new LanguageUtil(get());
    if (lng.toLowerCase().indexOf('-latn') > 1) return 'ltr';
    return rtlLngs.includes(languageUtils.getLanguagePartFromCode(lng)) || lng.toLowerCase().indexOf('-arab') > 1 ? 'rtl' : 'ltr';
  }
  static createInstance(options = {}, callback) {
    const instance = new I18n(options, callback);
    instance.createInstance = I18n.createInstance;
    return instance;
  }
  cloneInstance(options = {}, callback = noop) {
    const forkResourceStore = options.forkResourceStore;
    if (forkResourceStore) {
      options = {
        ...options
      };
      delete options.forkResourceStore;
    }
    const mergedOptions = {
      ...this.options,
      preload: false,
      ...options,
      ...{
        isClone: true
      }
    };
    const clone = new I18n(mergedOptions);
    if (options.debug !== undefined || options.prefix !== undefined) {
      clone.logger = clone.logger.clone(options);
    }
    const membersToCopy = ['store', 'services', 'language'];
    membersToCopy.forEach(m => {
      clone[m] = this[m];
    });
    clone.services = {
      ...this.services
    };
    clone.services.utils = {
      ...clone.services.utils,
      hasLoadedNamespace: clone.hasLoadedNamespace.bind(clone),
      reloadResources: clone.reloadResources.bind(clone)
    };
    if (forkResourceStore) {
      const copyData = obj => {
        const copied = Array.isArray(obj) ? [...obj] : {
          ...obj
        };
        Object.keys(copied).forEach(k => {
          if (copied[k] && typeof copied[k] === 'object') copied[k] = copyData(copied[k]);
        });
        return copied;
      };
      const clonedData = copyData(this.store.data);
      clone.store = new ResourceStore(clonedData, mergedOptions);
      clone.services.resourceStore = clone.store;
    }
    if (options.interpolation) {
      const defOpts = get();
      const mergedInterpolation = {
        ...defOpts.interpolation,
        ...this.options.interpolation,
        ...options.interpolation
      };
      const mergedForInterpolator = {
        ...mergedOptions,
        interpolation: mergedInterpolation
      };
      clone.services.interpolator = new Interpolator(mergedForInterpolator);
    }
    clone.translator = new Translator(clone.services, mergedOptions);
    clone.translator.on('*', (event, ...args) => {
      clone.emit(event, ...args);
    });
    clone.init(mergedOptions, callback);
    clone.translator.options = mergedOptions;
    clone.translator.backendConnector.newestCloneHasLoadedNamespace = clone.hasLoadedNamespace.bind(clone);
    return clone;
  }
  toJSON() {
    return {
      options: this.options,
      store: this.store,
      language: this.language,
      languages: this.languages,
      resolvedLanguage: this.resolvedLanguage
    };
  }
}
const instance = I18n.createInstance();

instance.createInstance;
instance.dir;
instance.init;
instance.loadResources;
instance.reloadResources;
instance.use;
instance.changeLanguage;
instance.getFixedT;
instance.t;
instance.exists;
instance.setDefaultNamespace;
instance.hasLoadedNamespace;
instance.loadNamespaces;
instance.loadLanguages;

const O = (n) => {
  if (!n) return ["", void 0];
  const e = n.replace(/_/g, "-");
  try {
    const t = new Intl.Locale(e);
    return [
      t.language.toLowerCase(),
      t.region?.toUpperCase()
    ];
  } catch {
    const t = e.split("-");
    return [
      t[0].toLowerCase(),
      t[1]?.toUpperCase()
    ];
  }
}, me = {
  cmn: "cmn",
  "cmn-CN": "cmn-CN",
  "cmn-TW": "cmn-TW",
  zh: "cmn",
  "zh-CN": "cmn-CN",
  "zh-TW": "cmn-TW",
  yue: "yue",
  "yue-HK": "yue-HK",
  "zh-HK": "yue-HK",
  wuu: "wuu",
  "wuu-CN": "wuu-CN"
}, V = (n) => {
  if (!n) return "";
  const e = (a) => {
    if (!/\w{2,3}-\w{2,3}/.test(a)) return a;
    const [r, o] = a.split("-");
    return `${r}-${o.toUpperCase()}`;
  }, t = n.toLowerCase().replace(/_/g, "-"), s = e(t), i = e(t.split("-").filter((a, r) => r === 0 || !/^[a-z]{4}$/.test(a)).join("-"));
  return me[s] || me[i] || s;
}, ie = (n) => V(n).split("-")[0], Q = {
  ar: {
    defaultRegion: "SA",
    availableRegions: [
      "001",
      "AE",
      "AS",
      "BH",
      "DZ",
      "EG",
      "IQ",
      "JO",
      "KW",
      "LB",
      "LY",
      "MA",
      "OM",
      "QA",
      "SA",
      "SY",
      "TN",
      "YE"
    ],
    testUtterance: "مرحبًا، اسمي {name} وأنا صوت عربي."
  },
  bg: {
    defaultRegion: "BG",
    availableRegions: [
      "BG"
    ],
    testUtterance: "Здравейте, казвам се {name} и съм български глас."
  },
  bho: {
    defaultRegion: "IN",
    availableRegions: [
      "IN"
    ],
    testUtterance: "नमस्कार, हमार नाम {name} ह आ हम भोजपुरी आवाज हईं"
  },
  bn: {
    defaultRegion: "IN",
    availableRegions: [
      "BD",
      "IN"
    ],
    testUtterance: "হ্যালো, আমার নাম {name} এবং আমি একজন বাংলা ভয়েস।"
  },
  ca: {
    defaultRegion: "ES",
    availableRegions: [
      "ES"
    ],
    testUtterance: "Hola, em dic {name} i sóc una veu catalana"
  },
  cmn: {
    defaultRegion: "CN",
    availableRegions: [
      "CN",
      "CTW",
      "TW"
    ],
    testUtterance: "你好，我的名字是 {name}，我是普通话配音。"
  },
  cs: {
    defaultRegion: "CZ",
    availableRegions: [
      "CZ"
    ],
    testUtterance: "Dobrý den, jmenuji se {name} a jsem český hlas."
  },
  da: {
    defaultRegion: "DK",
    availableRegions: [
      "DK"
    ],
    testUtterance: "Hej, mit navn er {name} og jeg er en dansk stemme."
  },
  de: {
    defaultRegion: "DE",
    availableRegions: [
      "AT",
      "CH",
      "DE"
    ],
    testUtterance: "Hallo, mein Name ist {name} und ich bin eine deutsche Stimme."
  },
  el: {
    defaultRegion: "GR",
    availableRegions: [
      "GR"
    ],
    testUtterance: "Γεια σας, με λένε {name} και είμαι ελληνική φωνή."
  },
  en: {
    defaultRegion: "US",
    availableRegions: [
      "AU",
      "CA",
      "GB",
      "HK",
      "IE",
      "IN",
      "KE",
      "NG",
      "NZ",
      "PH",
      "SG",
      "TZ",
      "US",
      "ZA"
    ],
    testUtterance: "Hello, my name is {name} and I am an English voice."
  },
  es: {
    defaultRegion: "ES",
    availableRegions: [
      "AR",
      "BO",
      "CL",
      "CO",
      "CR",
      "CU",
      "DO",
      "EC",
      "ES",
      "GQ",
      "GT",
      "HN",
      "MX",
      "NI",
      "PA",
      "PE",
      "PR",
      "PY",
      "SV",
      "US",
      "UY",
      "VE"
    ],
    testUtterance: "Hola, mi nombre es {name} y soy una voz española."
  },
  eu: {
    defaultRegion: "ES",
    availableRegions: [
      "ES"
    ],
    testUtterance: "Kaixo, nire izena {name} da eta euskal ahotsa naiz."
  },
  fa: {
    defaultRegion: "IR",
    availableRegions: [
      "IR"
    ],
    testUtterance: "سلام اسم من {name} و صدای فارسی هستم"
  },
  fi: {
    defaultRegion: "FI",
    availableRegions: [
      "FI"
    ],
    testUtterance: "Hei, nimeni on {name} ja olen suomalainen ääni."
  },
  fr: {
    defaultRegion: "FR",
    availableRegions: [
      "BE",
      "CA",
      "CH",
      "FR"
    ],
    testUtterance: "Bonjour, mon nom est {name} et je suis une voix française."
  },
  gl: {
    defaultRegion: "ES",
    availableRegions: [
      "ES"
    ],
    testUtterance: "Ola, chámome {name} e son unha voz galega."
  },
  he: {
    defaultRegion: "IL",
    availableRegions: [
      "IL"
    ],
    testUtterance: "שלום, שמי {name} ואני קול עברי."
  },
  hi: {
    defaultRegion: "IN",
    availableRegions: [
      "IN"
    ],
    testUtterance: "नमस्कार, मेरा नाम {name} है और मैं एक हिंदी आवाज़ हूँ।"
  },
  hr: {
    defaultRegion: "HR",
    availableRegions: [
      "HR"
    ],
    testUtterance: "Pozdrav, ja sam {name} i hrvatski sam glas."
  },
  hu: {
    defaultRegion: "HU",
    availableRegions: [
      "HU"
    ],
    testUtterance: "Helló, a nevem {name} és magyar hangú vagyok."
  },
  id: {
    defaultRegion: "ID",
    availableRegions: [
      "ID"
    ],
    testUtterance: "Halo, nama saya {name} dan saya suara Indonesia."
  },
  it: {
    defaultRegion: "IT",
    availableRegions: [
      "IT"
    ],
    testUtterance: "Ciao, mi chiamo {name} e sono una voce italiana."
  },
  ja: {
    defaultRegion: "JP",
    availableRegions: [
      "JP"
    ],
    testUtterance: "こんにちは。私の名前は{name}で、日本語の声を担当しています。"
  },
  kk: {
    defaultRegion: "KZ",
    availableRegions: [
      "KZ"
    ],
    testUtterance: "Sälemetsiz be, meniñ atım {name} jäne men qazaq dawısımın."
  },
  kn: {
    defaultRegion: "IN",
    availableRegions: [
      "IN"
    ],
    testUtterance: "ಹಲೋ, ನನ್ನ ಹೆಸರು {name} ಮತ್ತು ನಾನು ಕನ್ನಡ ಧ್ವನಿ."
  },
  ko: {
    defaultRegion: "KR",
    availableRegions: [
      "KR"
    ],
    testUtterance: "안녕하세요, 저는 {name}이고 한국어 음성입니다."
  },
  mr: {
    defaultRegion: "IN",
    availableRegions: [
      "IN"
    ],
    testUtterance: "नमस्कार, माझे नाव {name} आहे आणि मी एक मराठी आवाज आहे."
  },
  ms: {
    defaultRegion: "MY",
    availableRegions: [
      "MY"
    ],
    testUtterance: "Hello, nama saya {name} dan saya suara Melayu."
  },
  nb: {
    defaultRegion: "NO",
    availableRegions: [
      "NO"
    ],
    testUtterance: "Hei, jeg heter {name} og er en norsk stemme."
  },
  nl: {
    defaultRegion: "NL",
    availableRegions: [
      "BE",
      "NL"
    ],
    testUtterance: "Hallo, mijn naam is {name} en ik ben een Nederlandse stem."
  },
  pl: {
    defaultRegion: "PL",
    availableRegions: [
      "PL"
    ],
    testUtterance: "Cześć, nazywam się {name} i mam polski głos."
  },
  pt: {
    defaultRegion: "BR",
    availableRegions: [
      "BR",
      "PT"
    ],
    testUtterance: "Olá, o meu nome é {name} e sou uma voz portuguesa."
  },
  ro: {
    defaultRegion: "RO",
    availableRegions: [
      "RO"
    ],
    testUtterance: "Buna ziua, ma numesc {name} si sunt o voce romaneasca."
  },
  ru: {
    defaultRegion: "RU",
    availableRegions: [
      "RU"
    ],
    testUtterance: "Здравствуйте, меня зовут {name} и я русский голос."
  },
  sk: {
    defaultRegion: "SK",
    availableRegions: [
      "SK"
    ],
    testUtterance: "Dobrý deň, volám sa {name} a som slovenský hlas."
  },
  sl: {
    defaultRegion: "SI",
    availableRegions: [
      "SI"
    ],
    testUtterance: "Pozdravljeni, moje ime je {name} in sem slovenski glas."
  },
  sv: {
    defaultRegion: "SE",
    availableRegions: [
      "SE"
    ],
    testUtterance: "Hej, jag heter {name} och jag är en svensk röst."
  },
  ta: {
    defaultRegion: "IN",
    availableRegions: [
      "IN",
      "LK",
      "MY",
      "SG"
    ],
    testUtterance: "வணக்கம், என் பெயர் {name} மற்றும் நான் ஒரு தமிழ் குரல்"
  },
  te: {
    defaultRegion: "IN",
    availableRegions: [
      "IN"
    ],
    testUtterance: "హలో, నా పేరు {name} మరియు నేను తెలుగు వాణిని."
  },
  th: {
    defaultRegion: "TH",
    availableRegions: [
      "TH"
    ],
    testUtterance: "สวัสดีค่ะ ฉันชื่อ {name} และฉันเป็นคนมีเสียงภาษาไทย"
  },
  tr: {
    defaultRegion: "TR",
    availableRegions: [
      "TR"
    ],
    testUtterance: "Merhaba, adım {name} ve Türk sesiyim."
  },
  uk: {
    defaultRegion: "UA",
    availableRegions: [
      "UA"
    ],
    testUtterance: "Здравствуйте, меня зовут {name} и я украинский голос."
  },
  vi: {
    defaultRegion: "VN",
    availableRegions: [
      "VN"
    ],
    testUtterance: "Xin chào, tôi tên là {name} và tôi là giọng nói tiếng Việt."
  },
  wuu: {
    defaultRegion: "CN",
    availableRegions: [
      "CN"
    ],
    testUtterance: "你好，我的名字是 {name}，我是吴语配音。"
  },
  yue: {
    defaultRegion: "HK",
    availableRegions: [
      "HK"
    ],
    testUtterance: "你好，我叫 {name}，係越中文聲。"
  }
}, Et = /* @__PURE__ */ new Map(), oa = /* @__PURE__ */ Object.assign({ "../../json/ar.json": () => Promise.resolve().then(function () { return arBGKtJRyt; }), "../../json/bg.json": () => Promise.resolve().then(function () { return bgD9Q1JriY; }), "../../json/bho.json": () => Promise.resolve().then(function () { return bhoCpuLBMN3; }), "../../json/bn.json": () => Promise.resolve().then(function () { return bnBpn_lzoe; }), "../../json/ca.json": () => Promise.resolve().then(function () { return ca5hzouNcE; }), "../../json/cmn.json": () => Promise.resolve().then(function () { return cmnDlnYMCd8; }), "../../json/cs.json": () => Promise.resolve().then(function () { return csCDpMkMNO; }), "../../json/da.json": () => Promise.resolve().then(function () { return daXWCfWAwB; }), "../../json/de.json": () => Promise.resolve().then(function () { return deDU0USiOh; }), "../../json/el.json": () => Promise.resolve().then(function () { return elClBwbIAW; }), "../../json/en.json": () => Promise.resolve().then(function () { return enL3wcpTw3; }), "../../json/es.json": () => Promise.resolve().then(function () { return esDwOFJY07; }), "../../json/eu.json": () => Promise.resolve().then(function () { return euDxWirHU_; }), "../../json/fa.json": () => Promise.resolve().then(function () { return faMl9KtIw1; }), "../../json/fi.json": () => Promise.resolve().then(function () { return fiDk5Fhhl; }), "../../json/fr.json": () => Promise.resolve().then(function () { return frMfhjukJ4; }), "../../json/gl.json": () => Promise.resolve().then(function () { return glDwtzWds9; }), "../../json/he.json": () => Promise.resolve().then(function () { return heCfajFNE_; }), "../../json/hi.json": () => Promise.resolve().then(function () { return hiPv2ttBoh; }), "../../json/hr.json": () => Promise.resolve().then(function () { return hrMRApcEKR; }), "../../json/hu.json": () => Promise.resolve().then(function () { return huDGRDZdHH; }), "../../json/id.json": () => Promise.resolve().then(function () { return idDZUuUiTG; }), "../../json/it.json": () => Promise.resolve().then(function () { return itDJUYnjyj; }), "../../json/ja.json": () => Promise.resolve().then(function () { return jaBpFcZRMu; }), "../../json/kk.json": () => Promise.resolve().then(function () { return kkC480t1iH; }), "../../json/kn.json": () => Promise.resolve().then(function () { return knBVqs26qv; }), "../../json/ko.json": () => Promise.resolve().then(function () { return koTNoPZd6N; }), "../../json/mr.json": () => Promise.resolve().then(function () { return mrDstAHTvT; }), "../../json/ms.json": () => Promise.resolve().then(function () { return msBceBSDJ; }), "../../json/nb.json": () => Promise.resolve().then(function () { return nbCwPbwGI; }), "../../json/nl.json": () => Promise.resolve().then(function () { return nlBmWDmw5; }), "../../json/pl.json": () => Promise.resolve().then(function () { return plCH8qoDu8; }), "../../json/pt.json": () => Promise.resolve().then(function () { return ptCjCENn24; }), "../../json/ro.json": () => Promise.resolve().then(function () { return roBlJN7qkA; }), "../../json/ru.json": () => Promise.resolve().then(function () { return ruUdzq1D5e; }), "../../json/sk.json": () => Promise.resolve().then(function () { return skVAEHsTWJ; }), "../../json/sl.json": () => Promise.resolve().then(function () { return slDaZQ1gp0; }), "../../json/sv.json": () => Promise.resolve().then(function () { return svCicHwXe4; }), "../../json/ta.json": () => Promise.resolve().then(function () { return taCvpRY89g; }), "../../json/te.json": () => Promise.resolve().then(function () { return teD5TcdW9V; }), "../../json/th.json": () => Promise.resolve().then(function () { return thCYakoFVa; }), "../../json/tr.json": () => Promise.resolve().then(function () { return trBfYrcAz7; }), "../../json/uk.json": () => Promise.resolve().then(function () { return ukBVs6lQbX; }), "../../json/vi.json": () => Promise.resolve().then(function () { return viDP1xN9KL; }), "../../json/wuu.json": () => Promise.resolve().then(function () { return wuuC6uQvT6g; }), "../../json/yue.json": () => Promise.resolve().then(function () { return yueC8kEWdfv; }) });
async function la(n) {
  try {
    const e = n.split("-")[0], t = oa[`../../json/${e}.json`];
    if (!t)
      throw new Error(`No voice data found for language: ${n}`);
    const i = (await t()).default;
    return {
      ...i,
      voices: i.voices.map(ha)
    };
  } catch (e) {
    return console.warn(`Failed to load voice data for ${n}:`, e), {
      language: n,
      defaultRegion: "",
      testUtterance: "",
      voices: []
    };
  }
}
function On(n) {
  return Et.has(n) || Et.set(n, la(n)), Et.get(n);
}
const ca = ["veryLow", "low", "normal", "high", "veryHigh"], ua = ["android", "apple"], ha = (n) => ({
  ...n,
  quality: n.quality?.filter((e) => ca.includes(e)),
  localizedName: n.localizedName && ua.includes(n.localizedName) ? n.localizedName : void 0
}), Ot = async (n) => {
  if (!n) return [];
  try {
    const e = V(n);
    try {
      const s = await On(e);
      if (s?.voices?.length)
        return s.voices;
    } catch (s) {
      console.warn(`Failed to load voices for ${e}:`, s);
    }
    const [t] = O(e);
    if (t !== e)
      try {
        const s = await On(t);
        if (s?.voices?.length)
          return s.voices;
      } catch (s) {
        console.warn(`Failed to load voices for base language ${t}:`, s);
      }
    return [];
  } catch (e) {
    return console.error(`Error in getVoices for ${n}:`, e), [];
  }
}, Lt = (n, e) => {
  try {
    return new Intl.DisplayNames(
      e ? [e] : [],
      { type: "language", languageDisplay: "standard" }
    ).of(n) || n.toUpperCase();
  } catch {
    return n.toUpperCase();
  }
}, Ln = (n) => {
  if (!n) return "";
  try {
    const e = V(n), t = Q[e];
    if (t?.testUtterance)
      return t.testUtterance;
    if (e in me) {
      const i = me[e];
      if (i && Q[i]?.testUtterance)
        return Q[i].testUtterance;
    }
    const [s] = O(e);
    return s !== e && Q[s]?.testUtterance ? Q[s].testUtterance : "";
  } catch (e) {
    return console.error(`Error in getTestUtterance for ${n}:`, e), "";
  }
}, ht = (n) => {
  if (!n) return "";
  try {
    const e = V(n), t = Q[e];
    if (t?.defaultRegion)
      return `${e}-${t.defaultRegion}`;
    if (e in me) {
      const i = me[e];
      if (i) {
        const a = Q[i];
        if (a?.defaultRegion)
          return `${i}-${a.defaultRegion}`;
      }
    }
    const [s] = O(e);
    if (s !== e) {
      const i = Q[s];
      if (i?.defaultRegion)
        return `${s}-${i.defaultRegion}`;
    }
    return "";
  } catch (e) {
    return console.error(`Failed to get default region for ${n}:`, e), "";
  }
}, dt = (n) => {
  if (!n?.length) return [];
  const e = /* @__PURE__ */ new Set(), t = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Map();
  for (const [i, a] of n.entries()) {
    if (!a) continue;
    const r = V(a), [o, l] = O(r);
    l && (e.add(l), s.has(l) || s.set(l, i)), t.has(o) || t.set(o, /* @__PURE__ */ new Set()), l && t.get(o).add(l);
  }
  return Array.from(t.entries()).map(([i, a]) => {
    const r = new Set(
      Q[i]?.availableRegions || []
    ), o = Array.from(a), l = Array.from(e).filter(
      (u) => r.has(u) && !o.includes(u)
    ), c = Array.from(/* @__PURE__ */ new Set([...o, ...l])).sort((u, h) => {
      const d = s.get(u) ?? Number.MAX_SAFE_INTEGER, g = s.get(h) ?? Number.MAX_SAFE_INTEGER;
      return d - g;
    });
    if (c.length === 0) {
      const u = ht(i), [, h] = O(u);
      h && c.push(h);
    }
    return {
      baseLang: i,
      regions: c
    };
  });
}, ve = async (n) => {
  const e = /* @__PURE__ */ new Map();
  for (const s of n) {
    if (s.source !== "json") continue;
    const [i] = O(s.language);
    e.has(i) || e.set(i, []), e.get(i).push(s);
  }
  const t = /* @__PURE__ */ new Map();
  for (const [s, i] of e.entries()) {
    const a = /* @__PURE__ */ new Map(), r = await Ot(s), o = /* @__PURE__ */ new Map();
    r.forEach((l, c) => {
      o.set(l.name.toLowerCase(), c), l.altNames?.forEach((u) => {
        o.set(u.toLowerCase(), c);
      });
    });
    for (const l of i) {
      const c = l.name.toLowerCase(), u = o.get(c);
      u !== void 0 && a.set(l.name, u);
    }
    a.size > 0 && t.set(s, a);
  }
  return t;
}, da = {
  veryLow: 1,
  low: 2,
  normal: 3,
  high: 4,
  veryHigh: 5
}, Je = (n) => n ? da[n] ?? 0 : 0, ae = (n, e, t, s) => {
  const i = Je(n.quality), a = Je(e.quality);
  if (t && s && n.source === "json" && e.source === "json") {
    const r = t.get(s);
    if (r) {
      const o = r.get(n.name), l = r.get(e.name);
      if (o !== void 0 && l !== void 0)
        return o - l;
    }
  }
  return a !== i ? a - i : n.name.localeCompare(e.name);
}, gt = (n, e) => {
  const t = new Map(e.map((a) => [a.baseLang, a])), s = /* @__PURE__ */ new Map(), i = [];
  for (const a of n) {
    const [r] = O(a.language);
    t.get(r) ? (s.has(r) || s.set(r, []), s.get(r).push(a)) : i.push(a);
  }
  return { voicesByLang: s, otherLangVoices: i };
}, ps = (n, e, t, s) => {
  const [, i] = O(n.language), [, a] = O(e.language), r = i && t.regions.includes(i), o = a && t.regions.includes(a);
  if (r && o) {
    const d = t.regions.indexOf(i), g = t.regions.indexOf(a);
    return d === g ? ae(n, e, s, t.baseLang) : d - g;
  }
  if (r) return -1;
  if (o) return 1;
  const l = ht(t.baseLang), [, c] = O(l), u = !!c && i === c, h = !!c && a === c;
  if (u && !h) return -1;
  if (!u && h) return 1;
  if (i && a) {
    const d = i.localeCompare(a);
    return d !== 0 ? d : ae(n, e, s, t.baseLang);
  }
  return i ? -1 : a ? 1 : ae(n, e, s, t.baseLang);
}, ga = async (n, e, t) => {
  const s = t ?? await ve(n);
  n.sort((i, a) => ps(i, a, e, s));
}, ms = (n, e, t) => {
  const [s] = O(n.language), [i] = O(e.language), a = Lt(s).toLowerCase(), r = Lt(i).toLowerCase(), o = a.localeCompare(r);
  if (o !== 0)
    return o;
  if (s === i) {
    const l = ht(s), [, c] = O(n.language), [, u] = O(e.language), h = l && c === l.split("-")[1], d = l && u === l.split("-")[1];
    if (h && !d) return -1;
    if (!h && d) return 1;
    if (c && u) {
      const g = c.localeCompare(u);
      if (g !== 0)
        return g;
    }
    return c && !u ? -1 : !c && u ? 1 : ae(n, e, t, s);
  }
  return ae(n, e, t, s);
}, Vt = async (n, e) => {
  const t = e ?? await ve(n);
  n.sort((s, i) => ms(s, i, t));
}, vs = async (n, e) => {
  if (!e?.length) return [];
  const t = dt(n || []), { voicesByLang: s, otherLangVoices: i } = gt(e, t), a = await ve(e), r = [];
  for (const o of t) {
    const l = s.get(o.baseLang);
    l && (await ga(l, o, a), r.push(...l));
  }
  return await Vt(i, a), r.push(...i), r;
}, fa = [{ name: "Albert", nativeID: ["com.apple.speech.synthesis.voice.Albert"], note: "This novelty voice is part of a pack preloaded by Apple.", os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Bad News", nativeID: ["com.apple.speech.synthesis.voice.BadNews"], note: "This novelty voice is part of a pack preloaded by Apple.", altNames: ["Mauvaises nouvelles", "Malas noticias", "Brutte notizie"], os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Bahh", nativeID: ["com.apple.speech.synthesis.voice.Bahh"], note: "This novelty voice is part of a pack preloaded by Apple.", os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Bells", nativeID: ["com.apple.speech.synthesis.voice.Bells"], note: "This novelty voice is part of a pack preloaded by Apple.", altNames: ["Cloches", "Campanas", "Campane"], os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Boing", nativeID: ["com.apple.speech.synthesis.voice.Boing"], note: "This novelty voice is part of a pack preloaded by Apple.", os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Bubbles", nativeID: ["com.apple.speech.synthesis.voice.Bubbles"], note: "This novelty voice is part of a pack preloaded by Apple.", altNames: ["Bulles", "Burbujas", "Bollicine"], os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Cellos", nativeID: ["com.apple.speech.synthesis.voice.Cellos"], note: "This novelty voice is part of a pack preloaded by Apple.", altNames: ["Violoncelles", "Violonchelos", "Violoncelli"], os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Good News", nativeID: ["com.apple.speech.synthesis.voice.GoodNews"], note: "This novelty voice is part of a pack preloaded by Apple.", altNames: ["Bonnes nouvelles", "Buenas noticias", "Buone notizie"], os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Jester", nativeID: ["com.apple.speech.synthesis.voice.Hysterical"], note: "This novelty voice is part of a pack preloaded by Apple.", altNames: ["Bouffon", "Bufón", "Giullare"], os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Organ", nativeID: ["com.apple.speech.synthesis.voice.Organ"], note: "This novelty voice is part of a pack preloaded by Apple.", altNames: ["Orgue", "Órgano", "Organo"], os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Superstar", nativeID: ["com.apple.speech.synthesis.voice.Princess"], note: "This novelty voice is part of a pack preloaded by Apple.", altNames: ["Superestrella"], os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Trinoids", nativeID: ["com.apple.speech.synthesis.voice.Trinoids"], note: "This novelty voice is part of a pack preloaded by Apple.", altNames: ["Trinoïdes"], os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Whisper", nativeID: ["com.apple.speech.synthesis.voice.Whisper"], note: "This novelty voice is part of a pack preloaded by Apple.", altNames: ["Murmure", "Susurro", "Sussurro"], os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Wobble", nativeID: ["com.apple.speech.synthesis.voice.Deranged"], note: "This novelty voice is part of a pack preloaded by Apple.", os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Zarvox", nativeID: ["com.apple.speech.synthesis.voice.Zarvox"], note: "This novelty voice is part of a pack preloaded by Apple.", os: ["macOS", "iOS", "iPadOS"], preloaded: true }], pa = {
  voices: fa
}, ma = [{ name: "Eddy", localizedName: "apple", note: "Eloquence voices are preloaded by default on Apple devices.", language: "en-US", otherLanguages: ["en-GB", "de-DE", "fr-FR", "fr-CA", "es-ES", "es-MX", "fi-FI", "it-IT", "ja-JP", "ko-KR", "pt-BR", "zh-CN", "zh-HK"], os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Flo", localizedName: "apple", note: "Eloquence voices are preloaded by default on Apple devices.", language: "en-US", otherLanguages: ["en-GB", "de-DE", "fr-FR", "fr-CA", "es-ES", "es-MX", "fi-FI", "it-IT", "ja-JP", "ko-KR", "pt-BR", "zh-CN", "zh-HK"], os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Grandma", localizedName: "apple", note: "Eloquence voices are preloaded by default on Apple devices.", language: "en-US", otherLanguages: ["en-GB", "de-DE", "fr-FR", "fr-CA", "es-ES", "es-MX", "fi-FI", "it-IT", "ja-JP", "ko-KR", "pt-BR", "zh-CN", "zh-HK"], os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Grandpa", localizedName: "apple", note: "Eloquence voices are preloaded by default on Apple devices.", language: "en-US", otherLanguages: ["en-GB", "de-DE", "fr-FR", "fr-CA", "es-ES", "es-MX", "fi-FI", "it-IT", "ja-JP", "ko-KR", "pt-BR", "zh-CN", "zh-HK"], os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Jacques", localizedName: "apple", note: "Eloquence voices are preloaded by default on Apple devices.", language: "en-US", otherLanguages: ["en-GB", "de-DE", "fr-FR", "fr-CA", "es-ES", "es-MX", "fi-FI", "it-IT", "ja-JP", "ko-KR", "pt-BR", "zh-CN", "zh-HK"], os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Reed", localizedName: "apple", note: "Eloquence voices are preloaded by default on Apple devices.", language: "en-US", otherLanguages: ["en-GB", "de-DE", "fr-FR", "fr-CA", "es-ES", "es-MX", "fi-FI", "it-IT", "ja-JP", "ko-KR", "pt-BR", "zh-CN", "zh-HK"], os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Rocko", localizedName: "apple", note: "Eloquence voices are preloaded by default on Apple devices.", language: "en-US", otherLanguages: ["en-GB", "de-DE", "fr-FR", "fr-CA", "es-ES", "es-MX", "fi-FI", "it-IT", "ja-JP", "ko-KR", "pt-BR", "zh-CN", "zh-HK"], os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Sandy", localizedName: "apple", note: "Eloquence voices are preloaded by default on Apple devices.", language: "en-US", otherLanguages: ["en-GB", "de-DE", "fr-FR", "fr-CA", "es-ES", "es-MX", "fi-FI", "it-IT", "ja-JP", "ko-KR", "pt-BR", "zh-CN", "zh-HK"], os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Shelley", localizedName: "apple", note: "Eloquence voices are preloaded by default on Apple devices.", language: "en-US", otherLanguages: ["en-GB", "de-DE", "fr-FR", "fr-CA", "es-ES", "es-MX", "fi-FI", "it-IT", "ja-JP", "ko-KR", "pt-BR", "zh-CN", "zh-HK"], os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Fred", language: "en-US", os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Junior", language: "en-US", os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Kathy", language: "en-US", os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "Ralph", language: "en-US", os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { name: "eSpeak Arabic", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "ar", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Bulgarian", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "bg", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Bengali", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "bn", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Catalan", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "ca", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Chinese (Mandarin, latin as English)", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "cmn", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Czech", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "cs", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Danish", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "da", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak German", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "de", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Greek", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "el", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Spanish (Spain)", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "es", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Estonian", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "et", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Finnish", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "fi", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Gujarati", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "gu", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Croatian", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "hr", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Hungarian", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "hu", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Indonesian", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "id", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Italian", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "it", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Kannada", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "kn", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Korean", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "ko", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Lithuanian", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "lt", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Latvian", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "lv", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Malayalm", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "ml", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Marathi", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "mr", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Malay", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "ms", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Norwegian Bokmål", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "nb", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Polish", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "pl", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Portuguese (Brazil)", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "pt-br", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Romanian", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "ro", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Russian", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "ru", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Slovak", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "sk", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Slovenian", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "sl", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Serbian", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "sv", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Swedish", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "sv", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Swahili", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "sw", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Tamil", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "ta", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Telugu", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "te", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Turkish", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "tr", os: ["ChromeOS"], preloaded: true }, { name: "eSpeak Vietnamese (Northern)", note: "eSpeak voices are preloaded by default on Chrome OS.", language: "vi", os: ["ChromeOS"], preloaded: true }], va = {
  voices: ma
}, ya = pa, Sa = va, Tt = (n, e) => ya.voices.some(
  (t) => n.includes(t.name) || e && t.nativeID?.some((s) => e.includes(s)) || t.altNames?.some((s) => n.includes(s))
), Ut = (n, e) => Sa.voices.some(
  (t) => n.includes(t.name)
) || e === "veryLow", Nt = (n) => n?.length ? n.filter((e) => !(e.isNovelty || Tt(e.name, e.voiceURI))) : [], zt = (n) => n?.length ? n.filter((e) => !Ut(e.name, e.quality)) : [], ba = (n, e) => {
  const t = (Array.isArray(e) ? e : [e]).map(ie);
  return n.filter((s) => [s.language, s.altLanguage].some((i) => !!i && t.includes(ie(i))));
}, wa = { ar: { normal: "محسن", high: "استثنائي" }, ca: { normal: "millorada", high: "prèmium" }, "cmn-CN": { normal: "优化音质", high: "高音质" }, "cmn-TW": { normal: "增強音質", high: "高音質" }, cs: { normal: "vylepšená verze", high: "prémiový" }, da: { normal: "forbedret", high: "høj kvalitet" }, de: { normal: "erweitert", high: "premium" }, el: { normal: "βελτιωμένη", high: "υψηλής ποιότητας" }, en: { normal: "Enhanced", high: "Premium" }, es: { normal: "mejorada", high: "premium" }, fi: { normal: "parannettu", high: "korkealaatuinen" }, fr: { normal: "premium", high: "de qualité" }, he: { normal: "משופר", high: "פרימיום" }, hi: { normal: "बेहतर", high: "प्रीमियम" }, hr: { normal: "poboljšani", high: "vrhunski" }, hu: { normal: "továbbfejlesztett", high: "prémium" }, id: { normal: "Ditingkatkan", high: "Premium" }, it: { normal: "ottimizzata", high: "premium" }, ja: { normal: "拡張", high: "プレミアム" }, ko: { normal: "고품질", high: "프리미엄" }, ms: { normal: "Dipertingkat", high: "Premium" }, nb: { normal: "forbedret", high: "premium" }, nl: { normal: "verbeterd", high: "premium" }, pl: { normal: "rozszerzony", high: "premium" }, pt: { normal: "melhorada", high: "premium" }, ro: { normal: "îmbunătățită", high: "premium" }, ru: { normal: "улучшенный", high: "высшее качество" }, sk: { normal: "vylepšený", high: "prémiový" }, sl: { normal: "izboljšano", high: "prvovrsten" }, sv: { normal: "förbättrad", high: "premium" }, th: { normal: "คุณภาพสูง", high: "คุณภาพสูง" }, tr: { normal: "Geliştirilmiş", high: "Yüksek Kaliteli" }, uk: { normal: "вдосконалений", high: "високої якості" }, vi: { normal: "Nâng cao", high: "Cao cấp" } }, ka = {
  quality: wa
}, Mt = {
  apple: ka.quality
  // android: androidQualities.quality
}, Ea = (n, e, t) => {
  if (!n) return;
  const s = Array.isArray(t) ? t : t ? [t] : [];
  for (const i of s)
    if (i && Mt[i]) {
      const a = Mt[i], r = O(e)[0], o = a[e] || a[r];
      if (o) {
        const l = n.toLowerCase(), { normal: c, high: u } = o;
        if (u && l.includes(u.toLowerCase()))
          return "high";
        if (c && l.includes(c.toLowerCase()))
          return "normal";
      }
    }
}, Ca = (n, e) => {
  const t = Mt[e];
  if (t)
    for (const [s, { high: i, normal: a }] of Object.entries(t)) {
      const r = i && n.some((l) => l.includes(i)), o = a && n.some((l) => l.includes(a));
      if (r && o)
        return s;
    }
}, Ra = {
  low: {
    values: ["super-compact", "compact"],
    quality: "low"
  },
  normal: {
    values: ["enhanced"],
    quality: "normal"
  },
  high: {
    values: ["premium"],
    quality: "high"
  }
}, Vn = (n) => {
  if (!n) return;
  const t = n.toLowerCase().split(/[._-]/);
  for (const s of Object.values(Ra))
    if (s.values.some((i) => t.includes(i)))
      return s.quality;
};
function Ia(n, e) {
  if (n.name === n.originalName) return n;
  if (e.name === e.originalName) return e;
  const t = [n.originalName, ...n.altNames || []], s = [e.originalName, ...e.altNames || []], i = t.findIndex((r) => s.includes(r)), a = s.findIndex((r) => t.includes(r));
  return i === -1 && a === -1 || i !== -1 && (a === -1 || i <= a) ? n : e;
}
function Pa(n, e) {
  if (!n.altNames && !e.altNames)
    return false;
  const t = n.originalName, s = e.originalName, i = n.altNames || [], a = e.altNames || [];
  return a.includes(t) || i.includes(s) ? true : i.filter((o) => a.includes(o)).length > 0;
}
const bs = () => {
  const e = typeof window < "u" && (window.navigator || {}).userAgent || "", t = () => /android/i.test(e), s = () => /kaios/i.test(e), i = () => /linux/i.test(e) && !t(), a = () => typeof window.InstallTrigger < "u" ? true : /firefox/i.test(e), r = () => /AppleWebKit/i.test(e) && !/Chrome|Chromium|Edg\/|OPR|Android/i.test(e);
  return {
    isAndroid: t(),
    isFirefox: a() || s(),
    isSafari: r(),
    isKaiOS: s(),
    isLinux: i()
  };
};
class A {
  static instance;
  static initializationPromise = null;
  systemLocale;
  isAndroid;
  voices = [];
  browserVoices = [];
  isInitialized = false;
  // Base language codes already parsed into `voices`; null means unscoped (everything loaded)
  scopedLanguages = null;
  broadenPromises = /* @__PURE__ */ new Map();
  constructor() {
    if (typeof window > "u" || !window.speechSynthesis)
      throw new Error("Web Speech API is not available in this environment");
    this.systemLocale = navigator.languages?.[0]?.split("-")[0] || "en", this.isAndroid = bs().isAndroid;
  }
  /**
   * Initialize voice manager, or broaden an already-initialized singleton to
   * also cover new languages. `languages` scope voice parsing to reduce
   * per-language JSON loading; omitting it on the first call loads everything,
   * but omitting it on a later call to an already-scoped instance is a no-op,
   * not a retroactive broaden-to-everything.
   * @param options Configuration options for voice loading
   * @param options.languages Optional array of preferred language codes to filter (or broaden to) voices
   * @param options.maxTimeout Maximum time in milliseconds to wait for voices to load (passed to getBrowserVoices, first call only)
   * @param options.interval Interval in milliseconds between voice loading checks (passed to getBrowserVoices, first call only)
   * @returns Promise that resolves with the WebSpeechVoiceManager instance
   */
  static async initialize(e) {
    if (A.instance?.isInitialized) {
      const t = A.instance;
      return e?.languages && e.languages.length > 0 && await t.broadenLanguages(e.languages), t;
    }
    return A.initializationPromise || (A.initializationPromise = (async () => {
      try {
        const t = new A();
        A.instance = t, t.browserVoices = await t.getBrowserVoices(e?.maxTimeout, e?.interval), t.updateSystemLocale(t.browserVoices);
        let s = t.browserVoices;
        return e?.languages && e.languages.length > 0 ? (s = t.filterBrowserVoicesByLanguages(t.browserVoices, e.languages), t.scopedLanguages = A.toBaseLangSet(e.languages)) : t.scopedLanguages = null, t.voices = await t.parseToReadiumSpeechVoices(s), t.isInitialized = !0, t;
      } catch (t) {
        throw A.initializationPromise = null, console.error("Failed to initialize WebSpeechVoiceManager:", t), t;
      }
    })()), A.initializationPromise;
  }
  /**
   * Filter browser voices based on preferred languages
   * @private
   */
  filterBrowserVoicesByLanguages(e, t) {
    if (!t?.length) return e;
    const s = A.toBaseLangSet(t);
    return e.filter((i) => {
      if (!i?.lang) return false;
      const a = V(i.lang), [r] = A.extractLangRegionFromBCP47(a);
      return s.has(r);
    });
  }
  /**
   * Extract base language codes (e.g. "en", "fr") from a list of BCP47 tags
   * @private
   */
  static toBaseLangSet(e) {
    return new Set(
      e.map((t) => {
        const s = V(t), [i] = A.extractLangRegionFromBCP47(s);
        return i;
      })
    );
  }
  /**
   * Broaden an already-initialized instance to also cover the given languages,
   * reusing the already-fetched `browserVoices` (no new speechSynthesis fetch).
   * No-op if the instance is already unscoped or already covers these languages.
   * @private
   */
  async broadenLanguages(e) {
    if (this.scopedLanguages === null) return;
    const s = [...A.toBaseLangSet(e)].filter((o) => !this.scopedLanguages.has(o));
    if (s.length === 0) return;
    const i = s.filter((o) => this.broadenPromises.has(o)), a = s.filter((o) => !this.broadenPromises.has(o));
    let r;
    a.length > 0 && (r = (async () => {
      const o = this.filterBrowserVoicesByLanguages(this.browserVoices, a), l = await this.parseToReadiumSpeechVoices(o);
      this.voices = [...this.voices, ...l], a.forEach((c) => this.scopedLanguages.add(c)), a.forEach((c) => this.broadenPromises.delete(c));
    })(), a.forEach((o) => this.broadenPromises.set(o, r))), await Promise.all([
      ...r ? [r] : [],
      ...i.map((o) => this.broadenPromises.get(o))
    ]);
  }
  /**
   * Extract language and region from BCP47 language tag
   * @param lang - The BCP47 language tag (e.g., "en-US", "zh-CN")
   * @returns A tuple of [language, region] where language is lowercase and region is UPPERCASE
   */
  static extractLangRegionFromBCP47(e) {
    return O(e);
  }
  /**
   * Clean voice name by removing specific formatting
   * @private
   */
  cleanVoiceName(e) {
    return e ? e.replace(/\s*\([^)]*\)/g, "").replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, " ").trim() : "";
  }
  /**
   * Normalize voice name for comparison by removing common variations
   * @private
   */
  normalizeVoiceName(e) {
    return this.cleanVoiceName(e.toLowerCase());
  }
  /**
   * Count occurrences of each voice based on language and normalized name
   * @private
   */
  countVoiceDuplicates(e) {
    const t = /* @__PURE__ */ new Map();
    for (const s of e) {
      if (!s?.name || !s?.lang) continue;
      const i = `${s.lang.toLowerCase()}_${this.normalizeVoiceName(s.name)}`;
      t.set(i, (t.get(i) || 0) + 1);
    }
    return t;
  }
  /**
   * Updates the system locale based on available voices by detecting quality indicators.
   * The method extracts voice names and attempts to find a matching locale with both
   * high and normal quality indicators. If found, updates the systemLocale property.
   * 
   * @param voices - Array of SpeechSynthesisVoice objects to analyze for locale detection
   * @returns void - Updates the systemLocale property if a matching locale is found
   */
  updateSystemLocale(e) {
    if (!e?.length) return;
    const t = e.map((i) => i.name), s = Ca(t, "apple");
    s && (this.systemLocale = s);
  }
  /**
   * Infer voice quality based on package, platform, JSON, or duplicate count
   * Returns null if quality cannot be determined
   * @private
   */
  inferVoiceQuality(e, t, s) {
    const i = e.voiceURI ? Vn(e.voiceURI) : void 0;
    if (i) return i;
    if (t?.nativeID && Array.isArray(t.nativeID))
      for (const a of t.nativeID) {
        const r = Vn(a);
        if (r) return r;
      }
    if (t?.localizedName && e.voiceURI && e.lang) {
      const a = Ea(
        e.voiceURI,
        this.systemLocale,
        t.localizedName
      );
      if (a) return a;
    }
    if (t?.quality && t.quality.length > 0) {
      const a = Math.min(s - 1, t.quality.length - 1), r = t.quality[a];
      if (r)
        return r;
    }
    return null;
  }
  /**
   * Find matching JSON voice by name or alternative names
   * @private
   */
  findMatchingJsonVoice(e, t) {
    return e.find(
      (s) => this.normalizeVoiceName(s.name) === t || s.altNames?.some((i) => this.normalizeVoiceName(i) === t)
    );
  }
  /**
   * Remove duplicate voices, keeping the highest quality version of each voice
   * @param voices Array of voices to remove duplicates from
   * @returns Filtered array with duplicates removed, keeping only the highest quality versions
   */
  removeDuplicates(e) {
    const t = /* @__PURE__ */ new Map();
    for (const s of e) {
      const i = `${s.language.toLowerCase()}_${this.normalizeVoiceName(s.name)}`, a = t.get(i);
      if (!a)
        t.set(i, s);
      else {
        const r = Je(a.quality), o = Je(s.quality);
        if (o === r && Pa(s, a)) {
          const l = Ia(s, a);
          t.set(i, l);
        } else
          o >= r && t.set(i, s);
      }
    }
    return Array.from(t.values());
  }
  /**
   * Get test utterance for a given language
   * @param language - Language code (e.g., "en", "fr", "es")
   * @returns Promise that resolves to the test utterance text
   */
  getTestUtterance(e) {
    if (!e) return "";
    const t = Ln(e);
    if (t) return t;
    const [s] = A.extractLangRegionFromBCP47(e);
    if (s && s !== e) {
      const i = Ln(s);
      if (i) return i;
    }
    return "";
  }
  /**
   * Get all voices matching the filter criteria
   * @returns Promise that resolves to an array of filtered voices
   */
  getVoices(e = {}) {
    if (!this.isInitialized)
      throw new Error("WebSpeechVoiceManager not initialized. Call initialize() first.");
    return this.filterVoices(e, [...this.voices]);
  }
  /**
   * Get available languages with voice counts
   * @param localization Optional BCP 47 language tag to use for language names
   * @param filterOptions Optional filters to apply to voices before counting languages
   * @param voices Optional array of voices to count (defaults to this.voices)
   */
  getLanguages(e, t, s) {
    if (!s && !this.isInitialized)
      throw new Error("WebSpeechVoiceManager not initialized. Call initialize() first.");
    const i = s ?? this.voices, a = t ? this.filterVoices(t, i) : i, r = this.countLanguages(a.map((o) => o.language), e);
    return s ? r : r.sort((o, l) => o.label.localeCompare(l.label));
  }
  /**
   * Get the languages of every voice the browser has, with voice counts, sorted by name
   * Unlike getLanguages(), it covers languages initialize() wasn't called with, without loading their voice data
   * @param localization Optional BCP 47 language tag to use for language names
   */
  getBrowserLanguages(e) {
    if (!this.isInitialized)
      throw new Error("WebSpeechVoiceManager not initialized. Call initialize() first.");
    const t = this.browserVoices.filter((s) => s?.lang).map((s) => s.lang);
    return this.countLanguages(t, e).sort((s, i) => s.label.localeCompare(i.label));
  }
  // By base language, in order of first occurrence
  countLanguages(e, t) {
    const s = /* @__PURE__ */ new Map();
    for (const i of e) {
      const a = V(i).split("-")[0];
      s.set(a, (s.get(a) ?? 0) + 1);
    }
    return [...s].map(([i, a]) => ({ code: i, label: Lt(i, t), count: a }));
  }
  /**
   * Get available regions with voice counts
   * @param localization Optional BCP 47 language tag to use for region names
   * @param filterOptions Optional filters to apply to voices before counting regions
   * @param voices Optional array of voices to count (defaults to this.voices)
   */
  getRegions(e, t, s) {
    if (!s && !this.isInitialized)
      throw new Error("WebSpeechVoiceManager not initialized. Call initialize() first.");
    const i = s ?? this.voices, a = t ? this.filterVoices(t, i) : i, r = [], o = /* @__PURE__ */ new Set(), l = /* @__PURE__ */ new Map();
    for (const c of a) {
      const [, u] = A.extractLangRegionFromBCP47(c.language);
      u && l.set(u, (l.get(u) || 0) + 1);
    }
    for (const c of a) {
      const [, u] = A.extractLangRegionFromBCP47(c.language);
      if (u && !o.has(u)) {
        let h = c.language;
        try {
          const d = e || navigator.language;
          h = new Intl.DisplayNames([d], { type: "region" }).of(u) || c.language;
        } catch (d) {
          console.warn(`Failed to get display name for region ${u}`, d);
        }
        r.push({
          code: u,
          label: h,
          count: l.get(u) || 0
        }), o.add(u);
      }
    }
    return s ? r : r.sort((c, u) => c.label.localeCompare(u.label));
  }
  /**
   * Get the default voice for language preferences
   * @param languages Array of preferred languages in order of preference, or a single language string
   * @param voices Optional pre-filtered voices array to use instead of fetching voices
   * @returns The default voice for the language, or null if no voices are available
   */
  async getDefaultVoice(e, t) {
    if (!e) return null;
    const s = Array.isArray(e) ? e : [e];
    let i = t || this.getVoices({ languages: s });
    return i.length ? (i = await this.sortVoicesByRegions(s, i), i[0]) : null;
  }
  getBrowserVoices(e = 1e4, t = 10) {
    const s = () => window.speechSynthesis?.getVoices() || [];
    if (!window.speechSynthesis)
      return Promise.resolve([]);
    const i = s();
    return Array.isArray(i) && i.length ? Promise.resolve(i) : new Promise((a, r) => {
      let o = Math.floor(e / t), l = false;
      const c = () => {
        if (l) return;
        l = true;
        const u = () => {
          if (o < 1) return a([]);
          --o;
          const h = s();
          if (Array.isArray(h) && h.length) return a(h);
          setTimeout(u, t);
        };
        setTimeout(u, t);
      };
      window.speechSynthesis.onvoiceschanged !== void 0 ? window.speechSynthesis.onvoiceschanged = () => {
        const u = s();
        Array.isArray(u) && u.length ? a(u) : c();
      } : c(), setTimeout(() => a([]), e);
    });
  }
  /**
   * Convert SpeechSynthesisVoice array to ReadiumSpeechVoice array
   * @private
   */
  async parseToReadiumSpeechVoices(e) {
    const t = this.countVoiceDuplicates(e);
    return await Promise.all(
      e.filter((i) => i?.name && i?.lang).map(async (i) => {
        const a = V(i.lang), [r] = A.extractLangRegionFromBCP47(a), o = this.normalizeVoiceName(i.name), l = `${i.lang.toLowerCase()}_${o}`, c = t.get(l) || 1;
        let u = await Ot(a);
        (!u || u.length === 0) && (u = await Ot(r));
        const h = this.findMatchingJsonVoice(u, o), d = this.inferVoiceQuality(i, h, c), g = this.isAndroid || !h ? { ...h?.controls, boundary: false } : h?.controls;
        return h ? {
          ...h,
          label: h.label ?? this.cleanVoiceName(i.name),
          source: "json",
          originalName: i.name,
          ...g && { controls: g },
          language: h.language ?? a,
          voiceURI: i.voiceURI,
          quality: d,
          isDefault: i.default || false,
          offlineAvailability: i.localService || false,
          isNovelty: Tt(i.name, i.voiceURI),
          isLowQuality: Ut(i.name, d)
        } : {
          source: "browser",
          label: this.cleanVoiceName(i.name),
          name: i.name,
          originalName: i.name,
          ...g && { controls: g },
          language: a,
          voiceURI: i.voiceURI,
          quality: d,
          isDefault: i.default || false,
          offlineAvailability: i.localService || false,
          isNovelty: Tt(i.name, i.voiceURI),
          isLowQuality: Ut(i.name, d)
        };
      })
    );
  }
  /**
   * Convert an ReadiumSpeechVoice to a native SpeechSynthesisVoice
   */
  convertToSpeechSynthesisVoice(e) {
    if (e)
      return this.browserVoices.find((t) => e.voiceURI !== void 0 && t.voiceURI === e.voiceURI) ?? this.browserVoices.find((t) => t.name === e.originalName) ?? this.browserVoices.find((t) => this.normalizeVoiceName(t.name) === this.normalizeVoiceName(e.name));
  }
  /**
   * Filter voices based on the provided options
   */
  filterVoices(e, t) {
    let s = t ? [...t] : [...this.voices];
    const i = {
      excludeNovelty: true,
      // Default to true to filter out novelty voices
      excludeVeryLowQuality: true,
      // Default to true to filter out very low quality voices
      removeDuplicates: true,
      // Default to true - remove duplicates by default
      ...e
      // Let explicit options override the defaults
    };
    if (i.languages && (s = ba(s, i.languages)), i.source && (s = s.filter((a) => a.source === i.source)), i.gender && (s = s.filter((a) => a.gender === i.gender)), i.quality) {
      const a = Array.isArray(i.quality) ? i.quality : [i.quality];
      s = s.filter((r) => r.quality && a.includes(r.quality));
    }
    return i.offlineOnly && (s = s.filter((a) => a.offlineAvailability === true)), i.provider && (s = s.filter(
      (a) => a.provider?.toLowerCase() === i.provider?.toLowerCase()
    )), i.excludeNovelty && (s = Nt(s)), i.excludeVeryLowQuality && (s = zt(s)), i.removeDuplicates && (s = this.removeDuplicates(s)), s;
  }
  /**
   * Filter out novelty voices
   * @param voices Array of voices to filter
   * @returns Filtered array with novelty voices removed
   */
  filterOutNoveltyVoices(e) {
    const t = e ?? this.voices;
    return Nt(t);
  }
  /**
   * Filter out very low quality voices
   * @param voices Array of voices to filter
   * @returns Filtered array with very low quality voices removed
   */
  filterOutVeryLowQualityVoices(e) {
    const t = e ?? this.voices;
    return zt(t);
  }
  /**
   * Sort voices by quality, respecting JSON name order, then alphabetically for undefined/null quality
   * @param voices Array of voices to sort
   * @returns Sorted array of voices
   */
  async sortVoicesByQuality(e) {
    const t = e || this.voices;
    if (!t?.length) return [];
    const s = await ve(t);
    return [...t].sort((i, a) => ae(i, a, s));
  }
  /**
   * Sort regions by default then alphabetically, sort voices by quality
   */
  static async sortByDefaultRegion(e, t) {
    const s = await ve(e), i = ht(t);
    e.sort((a, r) => {
      const [, o] = A.extractLangRegionFromBCP47(a.language), [, l] = A.extractLangRegionFromBCP47(r.language), c = i && o === i.split("-")[1], u = i && l === i.split("-")[1];
      return c && !u ? -1 : !c && u ? 1 : ae(a, r, s, t);
    });
  }
  /**
   * Sort voices by language preference, then alphabetically
   * @param voices Array of voices to sort
   * @param preferredLanguages Array of preferred language codes in order of preference
   * @returns Sorted array of voices
   */
  async sortVoicesByLanguages(e, t) {
    const s = t || this.voices;
    if (!s?.length) return [];
    if (!e?.length) {
      const l = [...s];
      return await Vt(l), l;
    }
    const i = dt(e), { voicesByLang: a, otherLangVoices: r } = gt(s, i), o = [];
    for (const l of i) {
      const c = a.get(l.baseLang);
      c && (await A.sortByDefaultRegion(c, l.baseLang), o.push(...c));
    }
    return await Vt(r), o.push(...r), o;
  }
  /**
   * Sort voices by region preference, then alphabetically
   * @param voices Array of voices to sort
   * @param preferredLanguages Array of preferred language codes in order of preference
   * @returns Sorted array of voices
   */
  async sortVoicesByRegions(e, t) {
    return vs(e, t || this.voices);
  }
  /**
   * Group voices by the specified criteria
   * @param voices Array of voices to group
   * @param options Grouping options
   * @returns Object with voice groups keyed by the grouping criteria
   */
  groupVoices(e, t) {
    const s = {}, i = t || this.voices;
    for (const a of i) {
      let r = "Unknown";
      switch (e) {
        case "languages":
          r = A.extractLangRegionFromBCP47(a.language)[0];
          break;
        case "gender":
          r = a.gender || "unknown";
          break;
        case "quality":
          r = a.quality || "unknown";
          break;
        case "region":
          const [, o] = A.extractLangRegionFromBCP47(a.language);
          r = o || "unknown";
          break;
      }
      s[r] || (s[r] = []), s[r].push(a);
    }
    return s;
  }
}
const Ks = ["audio", "caption", "figure", "image", "math", "table", "video"], Ws = [
  ...Ks,
  "blockquote",
  "chapter",
  "cover",
  "details",
  "notice",
  "part",
  "preformatted",
  "qna",
  "row",
  "rowheader",
  "subtitle",
  "tip"
], Cr = [
  ...Ws,
  "abstract",
  "acknowledgments",
  "afterword",
  "appendix",
  "aside",
  "backlink",
  "bibliography",
  "biblioref",
  "colophon",
  "complementary",
  "conclusion",
  "credit",
  "credits",
  "dedication",
  "definition",
  "endnotes",
  "epigraph",
  "epilogue",
  "errata",
  "example",
  "footnote",
  "foreword",
  "glossary",
  "glossref",
  "heading1",
  "heading2",
  "heading3",
  "heading4",
  "heading5",
  "heading6",
  "index",
  "introduction",
  "list",
  "listItem",
  "noteref",
  "pagebreak",
  "pagelist",
  "preface",
  "prologue",
  "pullquote",
  "separator",
  "summary",
  "term"
]; ({
  few: new Set(Ks),
  some: new Set(Ws),
  most: new Set(Cr)
}); const Dt = {
  table: { few: "inline", some: "block", most: "block" }
};
function qe(n) {
  const e = {};
  for (const t of Object.keys(Dt))
    e[t] = Dt[t]?.[n] ?? "inline";
  return e;
}
({
  none: qe("none"),
  few: qe("few"),
  some: qe("some"),
  most: qe("most")
});
const ko = [
  // Headings
  "heading1",
  "heading2",
  "heading3",
  "heading4",
  "heading5",
  "heading6",
  // Text blocks
  "paragraph",
  "blockquote",
  "preformatted",
  "pullquote",
  // Lists
  "list",
  "listItem",
  // Tables
  "table",
  "row",
  "cell",
  "columnheader",
  "rowheader",
  // Media
  "audio",
  "video",
  "figure",
  "image",
  "math",
  // Sectioning / landmark containers
  "abstract",
  "acknowledgments",
  "afterword",
  "appendix",
  "article",
  "aside",
  "bibliography",
  "chapter",
  "colophon",
  "conclusion",
  "dedication",
  "endnotes",
  "epigraph",
  "epilogue",
  "errata",
  "example",
  "footnote",
  "foreword",
  "glossary",
  "index",
  "introduction",
  "notice",
  "part",
  "preface",
  "prologue",
  "qna",
  "section",
  "summary",
  "tip"
], Co = ["abbreviation", "biblioref", "glossref", "noteref", "pagebreak"], Ro = ["biblioref", "glossref"], Io = ["audio", "video", "image", "figure", "math", "table", "cover"], Po = ["cell", "rowheader"], Ao = ["separator"]; new Set(Co); new Set(Io); new Set(Po); new Set(Ao); new Set(Ro);
new Set(ko);

// What this app reads from Canvas's page: the open conversation and its
// language.

const CONVERSATION_PATH = /\/conversations\/([0-9a-f-]{32,36})(?:\/|$)/i;

// The Agent Server's ids drop the dashes Canvas's links may have, so ids are
// kept that way, one per conversation.
const conversationKey = (id) => id.replaceAll('-', '').toLowerCase();
const openConversationId = () => {
  const id = location.pathname.match(CONVERSATION_PATH)?.[1];
  return id ? conversationKey(id) : null;
};

// Canvas keeps its UI language on <html lang>.
const canvasLanguage = () => document.documentElement.lang || 'en';

// Reading aloud with the browser's voices: the Voice and Reading speed
// settings, with Readium Speech finding, rating and ranking the voices.


// Only English voices so far.
const LANGUAGE = 'en';
const QUALITY_LABELS = {
  veryLow: 'very low',
  low: 'low',
  normal: 'normal',
  high: 'high',
  veryHigh: 'very high',
};

const SPEEDS = SWITCHES.find(({ key }) => key === 'readingSpeed').options;
const readingRate = () => SPEEDS.find(([value]) => value === settings.readingSpeed)?.[2] ?? 1;

// What Readium found, once it has: the voices, best first, the one it
// picks for your region, and its sample sentence. Until then, the browser
// picks.
let loading = null;
let manager = null;
let ranked = [];
let automatic = null;
let sample = 'Hello, my name is {name} and I am an English voice.';

// Readium reads the browser's voices once, as soon as it has some, which
// Chrome only gives after the page loads.
function loadVoices() {
  loading ??= A.initialize({ languages: [LANGUAGE] })
    .then(async (found) => {
      const voices = found.getVoices({
        languages: LANGUAGE,
        excludeNovelty: true,
        excludeVeryLowQuality: true,
        removeDuplicates: true,
      });
      ranked = await found.sortVoicesByQuality(voices);
      const region = /^en-/i.test(window.navigator.language) ? window.navigator.language : 'en-US';
      automatic = await found.getDefaultVoice([region, LANGUAGE], ranked);
      sample = found.getTestUtterance(LANGUAGE) || sample;
      manager = found;
    })
    .catch(() => {});
  return loading;
}

// The browser's own voice for one of Readium's, by its name there.
const nameOf = (voice) => voice.originalName ?? voice.name;
const browserVoice = (name) =>
  (window.speechSynthesis?.getVoices?.() ?? []).find((voice) => voice.name === name) ?? null;

const regionName = (language) => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language', languageDisplay: 'standard' }).of(
      language,
    );
  } catch {
    return language;
  }
};

// Readium's label for a voice it rates, or else the browser's name, which
// Readium shortens, e.g. espeak's "English (America)" to "English".
const describe = (voice) =>
  [
    voice.quality ? voice.label : nameOf(voice),
    QUALITY_LABELS[voice.quality],
    voice.offlineAvailability === false && 'online',
  ]
    .filter(Boolean)
    .join(' · ');

// The Voice setting's choices: rated voices by region, the best region
// first, then the rest, each as [name, description].
function voiceGroups() {
  const groups = new Map();
  for (const voice of ranked) {
    const group = voice.quality ? regionName(voice.language) : 'Other voices';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push([nameOf(voice), describe(voice)]);
  }
  const other = groups.get('Other voices');
  groups.delete('Other voices');
  if (other) groups.set('Other voices', other);
  return [...groups];
}

// The Voice setting's voice, or else the one Readium picks, or none, for the
// browser to choose.
function chosenVoice(name = settings.voice) {
  return (
    (name && browserVoice(name)) ||
    (automatic && manager?.convertToSpeechSynthesisVoice(automatic)) ||
    null
  );
}

// What's queued to be read. Chrome forgets to say an utterance ended once
// nothing refers to it, so they're kept until the next read.
let queued = [];

// Queues the sentences to be read with the chosen voice and speed, then runs
// onDone once the last is read or fails, at once for none. Cancelling the
// queue skips onDone.
function read(sentences, onDone, name) {
  const synth = window.speechSynthesis;
  const voice = chosenVoice(name);
  synth.cancel();
  queued = sentences.map((sentence) => {
    const utterance = new window.SpeechSynthesisUtterance(sentence);
    utterance.lang = voice?.lang ?? canvasLanguage();
    if (voice) utterance.voice = voice;
    utterance.rate = readingRate();
    return utterance;
  });
  const last = queued.at(-1);
  if (!last) {
    onDone?.();
    return;
  }
  last.onend = () => onDone?.();
  last.onerror = (event) => {
    if (event?.error !== 'canceled' && event?.error !== 'interrupted') onDone?.();
  };
  for (const utterance of queued) synth.speak(utterance);
}

// Readium's sample sentence in a voice, by its name, or the chosen one.
function previewVoice(name) {
  const voice = chosenVoice(name);
  const label = voice
    ? (ranked.find((item) => nameOf(item) === voice.name)?.label ?? voice.name)
    : 'your browser';
  read([sample.replace('{name}', label)], null, name);
}

// The settings page and the switches it shows.


// Class strings mirror Canvas's ToggleSwitchVisual (src/ui/toggle-switch.tsx)
// so the switch picks up the same compiled Tailwind styles. The checkbox it
// stands for says it's a switch, as Canvas's own do, and its hint is read out
// when it changes, e.g. to say why a switch turned itself back off.
const TRACK_CLASS =
  'relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out motion-reduce:transition-none h-5.5 w-10 border';
const TRACK_ON_CLASS = 'border-contrast bg-contrast';
const TRACK_OFF_CLASS = 'border-border bg-surface-raised';
const THUMB_CLASS =
  'inline-block rounded-full transition-transform duration-200 ease-in-out motion-reduce:transition-none size-4';
const THUMB_ON_CLASS = 'translate-x-5.25 rtl:-translate-x-5.25 bg-base-secondary';
const THUMB_OFF_CLASS = 'translate-x-0.5 rtl:-translate-x-0.5 bg-muted';

// Canvas's formControlFieldClassName (form-control-classes.ts), as its
// settings fields look.
const SELECT_CLASS =
  'h-9 min-h-9 rounded-lg border border-control bg-base-secondary transition-control-shell duration-75 motion-reduce:transition-none focus:border-contrast/40 dark:focus:border-contrast/40 focus:ring-1 focus:ring-contrast/20 focus:outline-none w-full max-w-xs min-w-0 px-3 text-sm text-contrast cursor-pointer';

// A choice as a dropdown under its label.
function buildChoice(item, onChange) {
  const id = `voice-${item.key}`;
  const select = el(
    'select',
    SELECT_CLASS,
    ...item.options.map(([value, text]) => {
      const option = el('option', '', text);
      option.value = value;
      return option;
    }),
  );
  select.id = id;
  select.dataset.testid = `${id}-select`;
  select.value = settings[item.key];
  select.setAttribute('aria-describedby', `${id}-hint`);
  select.addEventListener('change', () => onChange({ ...settings, [item.key]: select.value }));
  const label = el('label', 'w-fit text-sm', item.label);
  label.htmlFor = id;
  const hint = el('p', 'text-xs leading-relaxed text-tertiary-light', item.description);
  hint.id = `${id}-hint`;
  return el('div', 'flex min-w-0 flex-col gap-2', label, select, hint);
}

// The browser's voices as a dropdown, with Automatic first and a saved voice
// this device doesn't have kept as it is. Picking one reads a sample in it,
// as does the button beside it.
function buildVoiceChoice(item, onChange) {
  const id = `voice-${item.key}`;
  const option = (value, text) => {
    const element = el('option', '', text);
    element.value = value;
    return element;
  };
  const groups = voiceGroups();
  const known = groups.some(([, voices]) => voices.some(([name]) => name === settings.voice));
  const select = el(
    'select',
    SELECT_CLASS,
    option('', 'Automatic (best available)'),
    ...(settings.voice && !known
      ? [option(settings.voice, `${settings.voice} (not on this device)`)]
      : []),
    ...groups.map(([group, voices]) => {
      const optgroup = el('optgroup', '', ...voices.map(([name, text]) => option(name, text)));
      optgroup.label = group;
      return optgroup;
    }),
  );
  select.id = id;
  select.dataset.testid = `${id}-select`;
  select.value = settings.voice;
  select.setAttribute('aria-describedby', `${id}-hint`);
  select.addEventListener('change', () => {
    onChange({ ...settings, [item.key]: select.value });
    previewVoice(select.value);
  });
  const label = el('label', 'w-fit text-sm', item.label);
  label.htmlFor = id;
  const hint = el('p', 'text-xs leading-relaxed text-tertiary-light', item.description);
  hint.id = `${id}-hint`;
  const preview = textButton('voice-preview', 'Preview', () => previewVoice(select.value));
  return el(
    'div',
    'flex min-w-0 flex-col gap-2',
    label,
    el('div', 'flex min-w-0 items-center gap-3', select, preview),
    hint,
  );
}

function buildSwitch(item, onChange) {
  const block = document.createElement('div');
  block.className = 'flex min-w-0 flex-col gap-1';
  block.innerHTML = `
    <label class="relative flex items-center gap-2 rounded-sm ${HAS_FOCUS_RING} w-fit cursor-pointer">
      <input class="sr-only" type="checkbox" role="switch" data-testid="voice-${item.key}-switch" aria-describedby="voice-${item.key}-hint" />
      <span aria-hidden="true"><span></span></span>
      <span class="flex items-center gap-1">
        <span class="text-sm"></span>
      </span>
    </label>
    <p id="voice-${item.key}-hint" class="text-xs leading-relaxed text-tertiary-light" aria-live="polite"></p>`;

  const input = block.querySelector('input');
  const track = input.nextElementSibling;
  const hint = block.querySelector('p');
  const enable = item.enable ?? item.check;
  block.querySelector('.text-sm').textContent = item.label;
  const render = () => {
    track.className = `${TRACK_CLASS} ${input.checked ? TRACK_ON_CLASS : TRACK_OFF_CLASS}`;
    track.firstElementChild.className = `${THUMB_CLASS} ${input.checked ? THUMB_ON_CLASS : THUMB_OFF_CLASS}`;
  };
  input.checked = settings[item.key];
  hint.textContent = (input.checked && item.check?.()) || item.description;
  render();
  input.addEventListener('change', async () => {
    const problem = input.checked && enable ? await enable() : null;
    // Reset, or another tab, rebuilt the switches while the browser asked.
    if (!block.isConnected) return;
    if (problem) input.checked = false;
    hint.textContent = problem ?? item.description;
    render();
    onChange({ ...settings, [item.key]: input.checked });
  });
  return block;
}

// The app's settings page, as declared in canvas-extension.json, which Canvas
// serves under /extensions/<app name>/ and links from its sidebar: the
// switches under their groups, and a button putting every one back. Settings
// changed in another tab, and voices the browser finds, redraw it.
const SETTINGS_PAGE = 'settings';

function settingsPage(onChange) {
  let list = null;

  function render() {
    if (!list) return;
    const groups = SWITCH_GROUPS.map((group) =>
      pageSection(
        group,
        ...SWITCHES.filter((item) => item.group === group).map((item) =>
          (item.voices ? buildVoiceChoice : item.options ? buildChoice : buildSwitch)(item, onChange),
        ),
      ),
    );
    const reset = textButton('voice-reset-settings', 'Reset settings', () => {
      onChange(null);
      render();
    });
    list.replaceChildren(...groups, reset);
  }

  function mount({ container }) {
    const own = el('div', 'flex min-w-0 flex-col gap-8');
    const root = el(
      'div',
      'flex min-w-0 flex-col px-4 pt-8 pb-12 md:px-8',
      el(
        'div',
        'mx-auto flex w-full min-w-0 max-w-200 flex-col gap-6',
        pageHeader(
          'Voice',
          "Talk with the agent and hear its replies, with your browser's voices. Settings are kept in this browser.",
        ),
        own,
      ),
    );
    root.setAttribute(OWN_ATTR, '');
    list = own;
    render();
    container.append(root);
    loadVoices().then(() => {
      if (list === own) render();
    });
    // Canvas may clean up a mount after the next one has started.
    return () => {
      if (list === own) list = null;
      root.remove();
    };
  }

  return {
    mount,
    onStorage(key) {
      if (key === STORAGE_KEY) render();
    },
  };
}

// Replies are Markdown, which is read out as raw text. Strip the syntax and
// cut on a word boundary without splitting an emoji.
function plainText(markdown, max = 200) {
  const text = markdown
    .replace(/```[\s\S]*?(?:```|$)/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*([-*_])(?:\s*\1){2,}\s*$/gm, ' ')
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/\*+|~~|`+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  const cut = chars.slice(0, max).join('');
  const space = cut.lastIndexOf(' ');
  return `${(space > cut.length / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

// Voice chat, Hands-free and Read aloud buttons: after you speak a message
// with Canvas's mic, send it, read the agent's reply aloud and listen again,
// stop the mic once you stop talking, and read any of the agent's messages.


// Canvas's mic, which says it's recording with aria-pressed and starting or
// transcribing with aria-busy, and puts what you said in the message box.
const MIC$1 = '[data-testid="chat-dictation-button"]';
const COMPOSER = '[data-testid="chat-input"]';
const SEND = '[data-testid="submit-button"]';
const STOP = '[data-testid="stop-button"]';
const AGENT_MESSAGE = 'article[data-testid="agent-message"]';
const READ_ALOUD_ATTR = 'data-voice-read-aloud';

// A run's statuses while it goes.
const ACTIVE_STATUSES = new Set(['running', 'waiting_for_confirmation']);

// How often to ask the Agent Server whether the reply is in, and how long to
// wait for what you said to reach the message box.
const REPLY_CHECK_MS = 2000;
const SEND_CHECK_MS = 100;
const SEND_TIMEOUT_MS = 3000;
const TRANSCRIBE_TIMEOUT_MS = 30000;

// Hands-free listens to the mic's level every LEVEL_MS: once you've talked
// for SPEECH_MS, a pause of SILENCE_MS stops the mic, as does saying nothing
// for QUIET_MS.
const LEVEL_MS = 50;
const SPEECH_MS = 250;
const SILENCE_MS = 1500;
const QUIET_MS = 10000;
const MIN_LEVEL = 0.015;

// Replies are cut to this many characters, and read a sentence at a time,
// as Chrome stops reading a long utterance after about 15 seconds.
const MAX_SPOKEN = 1500;

// What's said instead of a reply.
const SAY = {
  waiting_for_confirmation: 'The agent needs your confirmation.',
  error: 'The agent stopped with an error.',
  stuck: 'The agent got stuck.',
};

// Things you can say instead of a message, as what Canvas heard, without
// punctuation, gives them.
const COMMANDS = {
  stop: 'stop',
  'stop it': 'stop',
  pause: 'stop',
  cancel: 'cancel',
  'never mind': 'cancel',
  nevermind: 'cancel',
  repeat: 'repeat',
  'repeat that': 'repeat',
  'say that again': 'repeat',
  'new chat': 'newChat',
  'new conversation': 'newChat',
  'start a new chat': 'newChat',
};

const commandFor = (text) =>
  COMMANDS[
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
  ] ?? null;

// A speaker, as Canvas draws its message actions' icons.
const SPEAKER_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>';

const findMic = () => document.querySelector(MIC$1);
const pressed = (mic) => mic?.getAttribute('aria-pressed') === 'true';
const busy = (mic) => mic?.getAttribute('aria-busy') === 'true';

// The send button beside the mic, as there may be other message boxes.
function sendButton(mic) {
  for (let node = mic?.parentElement; node; node = node.parentElement) {
    const button = node.querySelector(SEND);
    if (button) return button;
  }
  return null;
}

// Text split into sentences in Canvas's language, or in one go for a
// language the browser doesn't know.
function sentencesOf(text) {
  let segments;
  try {
    segments = [...new Intl.Segmenter(canvasLanguage(), { granularity: 'sentence' }).segment(text)];
  } catch {
    segments = [{ segment: text }];
  }
  return segments.map(({ segment }) => segment.trim()).filter(Boolean);
}

// A reply as speech: Markdown stripped and code left on screen.
const spokenSentences = (markdown) =>
  sentencesOf(
    plainText(markdown.replace(/```[\s\S]*?(?:```|$)/g, ' The code is in the chat. '), MAX_SPOKEN),
  );

// One of the agent's messages on the page as speech, read in full, with
// paragraphs, items and cells as separate sentences.
function messageSentences(article) {
  const copy = article.cloneNode(true);
  for (const node of copy.querySelectorAll(':scope > div.absolute, button')) node.remove();
  for (const code of copy.querySelectorAll('pre')) code.replaceWith(' The code is in the chat. ');
  for (const block of copy.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, td, th, blockquote')) {
    block.append('\n');
  }
  return copy.textContent.split(/\n+/).flatMap((line) => sentencesOf(line.replace(/\s+/g, ' ')));
}

// Stops the mic after you stop talking, from its level on a second stream:
// Canvas's own recognition gives no sign until it's stopped.
function silenceDetector(onSilence) {
  let stopped = false;
  let stream = null;
  let context = null;
  let timer = 0;

  async function start() {
    const Context = window.AudioContext ?? window.webkitAudioContext;
    if (!Context || !window.navigator.mediaDevices?.getUserMedia) return;
    try {
      stream = await window.navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return;
    }
    if (stopped) {
      stop();
      return;
    }
    context = new Context();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    // The room's own level, so a noisy one still reads as quiet: it drops to
    // any quieter moment, such as between words, and creeps up otherwise.
    let floor = MIN_LEVEL;
    let spoke = 0;
    let quiet = 0;
    let elapsed = 0;
    const tick = () => {
      if (stopped) return;
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      const level = Math.sqrt(sum / samples.length);
      floor = Math.min(level, floor) * 0.998 + level * 0.002;
      const loud = level > Math.max(MIN_LEVEL, floor * 2.5);
      elapsed += LEVEL_MS;
      if (loud) {
        spoke += LEVEL_MS;
        quiet = 0;
      } else {
        quiet += LEVEL_MS;
      }
      const talked = spoke >= SPEECH_MS;
      if ((talked && quiet >= SILENCE_MS) || (!talked && elapsed >= QUIET_MS)) {
        stop();
        onSilence();
        return;
      }
      timer = setTimeout(tick, LEVEL_MS);
    };
    timer = setTimeout(tick, LEVEL_MS);
  }

  function stop() {
    stopped = true;
    clearTimeout(timer);
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = null;
    Promise.resolve(context?.close?.()).catch(() => {});
    context = null;
  }

  start();
  return stop;
}

// A turn goes listening → sending → waiting → speaking, then listens again
// by pressing the mic. Pressing a key, leaving the conversation or turning
// Voice chat off ends it. Each step that waits checks the turn is still the
// current one after.
function voiceChat(host) {
  // Conversations from the Agent Server, by id, as its batch endpoint gives
  // them.
  const loadConversations = (ids) =>
    host.agentServer.request({
      path: `/api/conversations?${ids.map((id) => `ids=${conversationKey(id)}`).join('&')}`,
    });
  // The turn: its stage, the conversation it's in, null on a new chat until
  // Canvas opens it, your last message there when it started, and whether
  // the run answering you was seen going.
  let turn = null;
  let wasPressed = false;
  let timer = 0;
  let stopDetector = null;
  let unlocked = false;
  // The screen's wake lock while a turn goes, as a promise of it, and the
  // message a Read aloud button is reading.
  let wakeLock = null;
  let reading = null;

  const on = () => settings.voiceChat || settings.handsFree || settings.readAloud;
  const at = (stage) => turn?.stage === stage;

  function end() {
    turn = null;
    clearTimeout(timer);
    timer = 0;
    letSleep();
    stopReading();
  }

  function stopReading() {
    if (reading) setReading(null);
    if (window.speechSynthesis?.speaking || window.speechSynthesis?.pending) {
      window.speechSynthesis.cancel();
    }
  }

  // Phones sleep, and stop listening, after a while without a touch.
  function keepAwake() {
    if (wakeLock || document.hidden || !window.navigator.wakeLock) return;
    wakeLock = window.navigator.wakeLock.request('screen').catch(() => null);
  }

  function letSleep() {
    const lock = wakeLock;
    wakeLock = null;
    lock?.then((sentinel) => sentinel?.release()).catch(() => {});
  }

  // The browser lets go of the lock when the tab's hidden.
  function onVisibility() {
    if (document.hidden || !turn) return;
    letSleep();
    keepAwake();
  }

  function stopListening() {
    stopDetector?.();
    stopDetector = null;
  }

  function onListen() {
    if (settings.handsFree && !stopDetector) {
      stopDetector = silenceDetector(() => {
        stopDetector = null;
        const mic = findMic();
        if (pressed(mic)) mic.click();
      });
    }
    if (!settings.voiceChat) return;
    // Pressing the mic while the reply is read talks over it.
    end();
    const id = openConversationId();
    const current = { stage: 'listening', id, baseline: id ? undefined : null, sawActive: false };
    turn = current;
    keepAwake();
    if (!id) return;
    loadConversations([id])
      .then(([info]) => {
        current.baseline = info?.last_user_message_id ?? null;
      })
      // Without it, there's no telling the reply from the last one.
      .catch(() => {
        if (turn === current) end();
      });
  }

  // Once what you said is in the message box, send it.
  function onStopped() {
    stopListening();
    if (!at('listening')) return;
    turn.stage = 'sending';
    const started = Date.now();
    const trySend = () => {
      const mic = findMic();
      const composer = document.querySelector(COMPOSER);
      const send = sendButton(mic);
      const waited = Date.now() - started;
      const text = composer?.textContent.trim();
      const command = text && !busy(mic) && commandFor(text);
      if (command) {
        clearComposer(composer);
        runCommand(command);
      } else if (text && send && !send.disabled && !busy(mic)) {
        send.click();
        turn.stage = 'waiting';
        timer = setTimeout(checkReply, REPLY_CHECK_MS);
      } else if (waited < (busy(mic) ? TRANSCRIBE_TIMEOUT_MS : SEND_TIMEOUT_MS)) {
        timer = setTimeout(trySend, SEND_CHECK_MS);
      } else {
        end();
      }
    };
    timer = setTimeout(trySend, SEND_CHECK_MS);
  }

  // Canvas's message box keeps its text in its own state, which hears input.
  function clearComposer(composer) {
    composer.textContent = '';
    composer.dispatchEvent(new window.InputEvent('input', { bubbles: true }));
  }

  // "Stop" presses Canvas's Stop, for a run you talked over; "repeat" reads
  // the last reply again; "new chat" opens one and listens there.
  async function runCommand(command) {
    const current = turn;
    if (command === 'stop') {
      document.querySelector(STOP)?.click();
      speak(['Stopped.'], false);
    } else if (command === 'cancel') {
      end();
    } else if (command === 'newChat') {
      host.navigate('/conversations');
      current.id = null;
      speak(['New chat.'], true);
    } else if (command === 'repeat' && current.id) {
      const result = await host.agentServer
        .request({ path: `/api/conversations/${current.id}/agent_final_response` })
        .catch(() => null);
      if (turn !== current) return;
      speak(spokenSentences(result?.response ?? ''), true);
    } else {
      end();
    }
  }

  // The reply is in once the run that answers your message has stopped:
  // the run was seen going, or the agent has added to the conversation since
  // your message.
  async function checkReply() {
    const current = turn;
    current.id ??= openConversationId();
    const info = current.id
      ? await loadConversations([current.id])
          .then(([result]) => result)
          .catch(() => null)
      : null;
    if (turn !== current) return;
    const status = info?.execution_status;
    const message = info?.last_user_message_id;
    const answered =
      !!message && current.baseline !== undefined && message !== current.baseline;
    const running = ACTIVE_STATUSES.has(status);
    if (answered && running) current.sawActive = true;
    const agentActed = !!info?.leaf_event_id && info.leaf_event_id !== message;
    const needsYou = status === 'waiting_for_confirmation';
    if (!answered || (running && !needsYou) || (!running && !current.sawActive && !agentActed)) {
      timer = setTimeout(checkReply, REPLY_CHECK_MS);
      return;
    }
    if (status === 'finished') {
      const result = await host.agentServer
        .request({ path: `/api/conversations/${current.id}/agent_final_response` })
        .catch(() => null);
      if (turn !== current) return;
      speak(spokenSentences(result?.response ?? ''), true);
    } else if (SAY[status]) {
      speak([SAY[status]], false);
    } else {
      end();
    }
  }

  // Reads the sentences, then, after a reply, listens again if you're still
  // looking at the conversation. end() cancels what's left.
  function speak(sentences, again) {
    const done = () => (again ? listenAgain() : end());
    if (!sentences.length || speechProblem()) {
      done();
      return;
    }
    const current = turn;
    current.stage = 'speaking';
    read(sentences, () => {
      if (turn === current) done();
    });
  }

  function listenAgain() {
    const { id } = turn;
    end();
    if (!settings.voiceChat) return;
    const mic = findMic();
    if (document.hidden || openConversationId() !== id) return;
    if (mic && !mic.disabled && !pressed(mic) && !busy(mic)) mic.click();
  }

  // A Read aloud button reads its message, or stops when it's reading, which
  // ends any turn, as does pressing the mic while it reads.
  function setReading(article) {
    for (const button of document.querySelectorAll(`[${READ_ALOUD_ATTR}]`)) {
      const on = button.closest(AGENT_MESSAGE) === article;
      button.setAttribute('aria-label', on ? 'Stop reading' : 'Read aloud');
      button.classList.toggle('text-contrast', on);
    }
    reading = article;
  }

  function onReadAloud(article) {
    if (reading === article) {
      stopReading();
      return;
    }
    end();
    if (speechProblem()) return;
    setReading(article);
    read(messageSentences(article), () => {
      if (reading === article) setReading(null);
    });
  }

  function addReadAloud() {
    for (const article of document.querySelectorAll(AGENT_MESSAGE)) {
      const actions = article.querySelector(':scope > div.absolute');
      if (!actions || actions.querySelector(`[${READ_ALOUD_ATTR}]`)) continue;
      const button = el('button', 'button-base p-1 cursor-pointer');
      button.type = 'button';
      button.setAttribute(OWN_ATTR, '');
      button.setAttribute(READ_ALOUD_ATTR, '');
      button.setAttribute('aria-label', reading === article ? 'Stop reading' : 'Read aloud');
      button.innerHTML = SPEAKER_ICON;
      button.addEventListener('click', () => onReadAloud(article));
      actions.prepend(button);
    }
  }

  function removeReadAloud() {
    for (const button of document.querySelectorAll(`[${READ_ALOUD_ATTR}]`)) button.remove();
  }

  // Browsers only let a page speak after a click or key press on it, and
  // Safari only from one, so the first press of the mic says nothing.
  function onPointerDown(event) {
    if (unlocked || !settings.voiceChat || !event.target?.closest?.(MIC$1)) return;
    if (speechProblem()) return;
    unlocked = true;
    window.speechSynthesis.speak(new window.SpeechSynthesisUtterance(''));
  }

  // A key press ends the turn, unless it's while you're talking, as dictation
  // takes keys too. Esc stops a Read aloud button.
  function onKeyDown(event) {
    if (reading && event.key === 'Escape') stopReading();
    if (!at('waiting') && !at('speaking')) return;
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
    end();
  }

  function onMicChange() {
    const now = pressed(findMic());
    if (now !== wasPressed) {
      wasPressed = now;
      if (now) onListen();
      else onStopped();
    }
    // Leaving the conversation ends its turn.
    if (turn?.id && openConversationId() !== turn.id) end();
  }

  // Canvas's mic only changes attributes as it starts and stops, which the
  // app's own page observer doesn't hear.
  const attributes = new MutationObserver(onMicChange);
  let listening = false;

  function listen(next) {
    if (next === listening) return;
    listening = next;
    if (next) {
      attributes.observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-pressed', 'aria-busy'],
      });
      window.addEventListener('pointerdown', onPointerDown, true);
      window.addEventListener('keydown', onKeyDown, true);
      document.addEventListener('visibilitychange', onVisibility);
      wasPressed = pressed(findMic());
    } else {
      attributes.disconnect();
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('visibilitychange', onVisibility);
      stopListening();
      end();
    }
  }

  return {
    refresh() {
      listen(on());
      if (!settings.handsFree) stopListening();
      if (!settings.voiceChat && turn) end();
      if (settings.readAloud) addReadAloud();
      else {
        if (reading) stopReading();
        removeReadAloud();
      }
    },
    onDomChange() {
      if (!listening) return;
      onMicChange();
      if (settings.readAloud) addReadAloud();
    },
    dispose() {
      listen(false);
    },
  };
}

// Mic shortcut: Alt+V presses Canvas's mic, from the message box too, on any
// keyboard layout, unless one of Canvas's dialogs is open.


const MIC = '[data-testid="chat-dictation-button"]';

function micShortcut() {
  function onKeyDown(event) {
    if (!settings.micShortcut || event.defaultPrevented || event.isComposing) return;
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.code !== 'KeyV' || document.querySelector('[aria-modal="true"]')) return;
    const mic = document.querySelector(MIC);
    if (!mic || mic.disabled) return;
    event.preventDefault();
    mic.click();
  }

  window.addEventListener('keydown', onKeyDown, true);
  return {
    dispose: () => window.removeEventListener('keydown', onKeyDown, true),
  };
}

// Voice: talk with the agent in Agent Canvas, each feature a setting in
// settings.js, turned on from this app's settings page and saved in the
// browser's localStorage. The README says what each does. Canvas loads an
// app from one file, so these modules and Readium Speech are built into
// extension.js.
//
// Each feature is an object with any of refresh() (settings changed),
// onDomChange(), onStorage(key) and dispose(), which activate() calls.

// The running copy's dispose, on the page's window. Canvas disposes an app
// before activating it again; should a copy still be running anyway, the new
// one stops it first, as two copies would both answer the mic.
const INSTANCE = Symbol.for('openhands-app-voice');

function activate(host) {
  if (host.apiVersion !== '1') {
    throw new Error(`Voice requires host API 1, got ${host.apiVersion}.`);
  }
  window[INSTANCE]?.();
  loadSettings();
  let disposed = false;
  // A switch can finish changing after the app is disposed, e.g. once you
  // answer a permission prompt.
  const settingsView = settingsPage((next) => {
    if (disposed) return;
    saveSettings(next);
    each('refresh');
  });
  // Before anything starts, as Canvas throws for a page its copy of the
  // manifest doesn't declare.
  const unregisterSettings = host.registerPage(SETTINGS_PAGE, settingsView.mount);
  const features = [
    settingsView,
    voiceChat(host),
    micShortcut(),
    // Readium finds the voices ahead of time, so reading starts at once.
    {
      refresh() {
        if (settings.voiceChat || settings.readAloud) loadVoices();
      },
    },
  ];
  function each(method, ...args) {
    for (const feature of features) feature[method]?.(...args);
  }
  // Settings changed in another tab apply here too.
  const onStorage = ({ key }) => {
    if (key === STORAGE_KEY) loadSettings();
    each('onStorage', key);
    if (key === STORAGE_KEY) each('refresh');
  };
  window.addEventListener('storage', onStorage);
  each('refresh');
  // Canvas re-renders the chat as a run's events stream in, which may bring a
  // new mic or new messages.
  const observer = new MutationObserver(() => each('onDomChange'));
  observer.observe(document.body, { childList: true, subtree: true });
  // Each feature cleans up even if one before it fails, whose error is then
  // passed on for Canvas to report.
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (window[INSTANCE] === dispose) delete window[INSTANCE];
    observer.disconnect();
    unregisterSettings?.();
    window.removeEventListener('storage', onStorage);
    let failure = null;
    for (const feature of features) {
      try {
        feature.dispose?.();
      } catch (error) {
        failure ??= error;
      }
    }
    if (failure) throw failure;
  };
  window[INSTANCE] = dispose;
  return dispose;
}

const l$z = "ar", a$J = "ar-SA", e$J = "مرحبًا، اسمي {name} وأنا صوت عربي.", r$a = [{ label: "Amina", name: "Microsoft Amina Online (Natural) - Arabic (Algeria)", language: "ar-DZ", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Ismael", name: "Microsoft Ismael Online (Natural) - Arabic (Algeria)", language: "ar-DZ", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Laila", name: "Microsoft Laila Online (Natural) - Arabic (Bahrain)", language: "ar-BH", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Ali", name: "Microsoft Ali Online (Natural) - Arabic (Bahrain)", language: "ar-BH", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Salma", name: "Microsoft Salma Online (Natural) - Arabic (Egypt)", language: "ar-EG", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Shakir", name: "Microsoft Shakir Online (Natural) - Arabic (Egypt)", language: "ar-EG", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Rana", name: "Microsoft Rana Online (Natural) - Arabic (Iraq)", language: "ar-IQ", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Bassel", name: "Microsoft Bassel Online (Natural) - Arabic (Iraq)", language: "ar-IQ", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Sana", name: "Microsoft Sana Online (Natural) - Arabic (Jordan)", language: "ar-JO", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Taim", name: "Microsoft Taim Online (Natural) - Arabic (Jordan)", language: "ar-JO", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Noura", name: "Microsoft Noura Online (Natural) - Arabic (Kuwait)", language: "ar-KW", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Fahed", name: "Microsoft Fahed Online (Natural) - Arabic (Kuwait)", language: "ar-KW", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Layla", name: "Microsoft Layla Online (Natural) - Arabic (Lebanon)", language: "ar-LB", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Rami", name: "Microsoft Rami Online (Natural) - Arabic (Lebanon)", language: "ar-LB", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Iman", name: "Microsoft Iman Online (Natural) - Arabic (Libya)", language: "ar-LY", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Omar", name: "Microsoft Omar Online (Natural) - Arabic (Libya)", language: "ar-LY", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Mouna", name: "Microsoft Mouna Online (Natural) - Arabic (Morocco)", language: "ar-MA", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Jamal", name: "Microsoft Jamal Online (Natural) - Arabic (Morocco)", language: "ar-MA", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Aysha", name: "Microsoft Aysha Online (Natural) - Arabic (Oman)", language: "ar-OM", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Abdullah", name: "Microsoft Abdullah Online (Natural) - Arabic (Oman)", language: "ar-OM", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Amal", name: "Microsoft Amal Online (Natural) - Arabic (Qatar)", language: "ar-QA", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Moaz", name: "Microsoft Moaz Online (Natural) - Arabic (Qatar)", language: "ar-QA", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Zariyah", name: "Microsoft Zariyah Online (Natural) - Arabic (Saudi Arabia)", language: "ar-SA", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Hamed", name: "Microsoft Hamed Online (Natural) - Arabic (Saudi Arabia)", language: "ar-SA", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Amany", name: "Microsoft Amany Online (Natural) - Arabic (Syria)", language: "ar-SY", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Laith", name: "Microsoft Laith Online (Natural) - Arabic (Syria)", language: "ar-SY", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Reem", name: "Microsoft Reem Online (Natural) - Arabic (Tunisia)", language: "ar-TN", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Hedi", name: "Microsoft Hedi Online (Natural) - Arabic (Tunisia)", language: "ar-TN", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Fatima", name: "Microsoft Fatima Online (Natural) - Arabic (United Arab Emirates)", language: "ar-AE", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Hamdan", name: "Microsoft Hamdan Online (Natural) - Arabic (United Arab Emirates)", language: "ar-AE", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Maryam", name: "Microsoft Maryam Online (Natural) - Arabic (Yemen)", language: "ar-YE", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Saleh", name: "Microsoft Saleh Online (Natural) - Arabic (Yemen)", language: "ar-YE", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Mariam", name: "Mariam", localizedName: "apple", language: "ar-001", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Apple Laila", name: "Laila", localizedName: "apple", language: "ar-001", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Tarik", name: "Tarik", localizedName: "apple", language: "ar-001", gender: "male", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Majed", name: "Majed", localizedName: "apple", language: "ar-001", gender: "male", quality: ["low", "normal", "high"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Hoda", name: "Microsoft Hoda - Arabic (Arabic )", language: "ar-EG", gender: "female", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Naayf", name: "Microsoft Naayf - Arabic (Saudi Arabia)", language: "ar-AS", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "صوت انثوي 1", name: "Android Speech Recognition and Synthesis from Google ar-xa-x-arc-network", altNames: ["Android Speech Recognition and Synthesis from Google ar-xa-x-arc-local", "Android Speech Recognition and Synthesis from Google ar-language"], nativeID: ["ar-xa-x-arc-network", "ar-xa-x-arc-local"], language: "ar", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "صوت انثوي 2", name: "Android Speech Recognition and Synthesis from Google ar-xa-x-arz-network", altNames: ["Android Speech Recognition and Synthesis from Google ar-xa-x-arz-local"], nativeID: ["ar-xa-x-arz-network", "ar-xa-x-arz-local"], language: "ar", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "صوت ذكر 1", name: "Android Speech Recognition and Synthesis from Google ar-xa-x-ard-network", altNames: ["Android Speech Recognition and Synthesis from Google ar-xa-x-ard-local"], nativeID: ["ar-xa-x-ard-network", "ar-xa-x-ard-local"], language: "ar", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "صوت ذكر 2", name: "Android Speech Recognition and Synthesis from Google ar-xa-x-are-network", altNames: ["Android Speech Recognition and Synthesis from Google ar-xa-x-are-local"], nativeID: ["ar-xa-x-are-network", "ar-xa-x-are-local"], language: "ar", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], o$A = {
  language: "ar",
  defaultRegion: a$J,
  testUtterance: e$J,
  voices: r$a
};

var arBGKtJRyt = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: o$A,
  defaultRegion: a$J,
  language: l$z,
  testUtterance: e$J,
  voices: r$a
});

const n$C = "bg", a$I = "bg-BG", e$I = "Здравейте, казвам се {name} и съм български глас.", l$y = [{ label: "Kalina", name: "Microsoft Kalina Online (Natural) - Bulgarian (Bulgaria)", language: "bg-BG", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Borislav", name: "Microsoft Borislav Online (Natural) - Bulgarian (Bulgaria)", language: "bg-BG", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Daria", name: "Daria", localizedName: "apple", language: "bg-BG", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Ivan", name: "Microsoft Ivan - Bulgarian (Bulgaria)", language: "bg-BG", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Женски глас", name: "Android Speech Recognition and Synthesis from Google bg-bg-x-ifk-network", altNames: ["Android Speech Recognition and Synthesis from Google bg-bg-x-ifk-local", "Android Speech Recognition and Synthesis from Google bg-bg-language"], nativeID: ["bg-bg-x-ifk-network", "bg-bg-x-ifk-local"], language: "bg-BG", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], o$z = {
  language: "bg",
  defaultRegion: a$I,
  testUtterance: e$I,
  voices: l$y
};

var bgD9Q1JriY = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: o$z,
  defaultRegion: a$I,
  language: n$C,
  testUtterance: e$I,
  voices: l$y
});

const t$8 = "bho", a$H = "bho-IN", e$H = "नमस्कार, हमार नाम {name} ह आ हम भोजपुरी आवाज हईं", o$y = [{ label: "Jaya", name: "Jaya", localizedName: "apple", language: "bho-IN", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }], l$x = {
  language: "bho",
  defaultRegion: a$H,
  testUtterance: e$H,
  voices: o$y
};

var bhoCpuLBMN3 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: l$x,
  defaultRegion: a$H,
  language: t$8,
  testUtterance: e$H,
  voices: o$y
});

const o$x = "bn", e$G = "bn-IN", n$B = "হ্যালো, আমার নাম {name} এবং আমি একজন বাংলা ভয়েস।", a$G = [{ label: "Tanishaa", name: "Microsoft Tanishaa Online (Natural) - Bengali (India)", language: "bn-IN", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Bashkar", name: "Microsoft Bashkar Online (Natural) - Bangla (India)", language: "bn-IN", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Nabanita", name: "Microsoft Nabanita Online (Natural) - Bangla (Bangladesh)", language: "bn-BD", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Pradeep", name: "Microsoft Pradeep Online (Natural) - Bangla (Bangladesh)", language: "bn-BD", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Piya", name: "Piya", localizedName: "apple", language: "bn-IN", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "মহিলা কণ্ঠস্বর 1", name: "Android Speech Recognition and Synthesis from Google bn-in-x-bnf-network", altNames: ["Android Speech Recognition and Synthesis from Google bn-in-x-bnf-local", "Android Speech Recognition and Synthesis from Google bn-IN-language"], nativeID: ["bn-in-x-bnf-network", "bn-in-x-bnf-local"], language: "bn-IN", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "মহিলা কণ্ঠস্বর 2", name: "Android Speech Recognition and Synthesis from Google bn-in-x-bnx-network", altNames: ["Android Speech Recognition and Synthesis from Google bn-in-x-bnx-local"], nativeID: ["bn-in-x-bnx-network", "bn-in-x-bnx-local"], language: "bn-IN", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "পুরুষ কন্ঠ 1", name: "Android Speech Recognition and Synthesis from Google bn-in-x-bin-network", altNames: ["Android Speech Recognition and Synthesis from Google bn-in-x-bin-local"], nativeID: ["bn-in-x-bin-network", "bn-in-x-bin-local"], language: "bn-IN", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "পুরুষ কন্ঠ 2", name: "Android Speech Recognition and Synthesis from Google bn-in-x-bnm-network", altNames: ["Android Speech Recognition and Synthesis from Google bn-in-x-bnm-local"], nativeID: ["bn-in-x-bnm-network", "bn-in-x-bnm-local"], language: "bn-IN", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "পুরুষ কন্ঠ", name: "Google বাংলা (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google bn-bd-x-ban-network", "Chrome OS বাংলা", "Android Speech Recognition and Synthesis from Google bn-bd-x-ban-local", "Android Speech Recognition and Synthesis from Google bn-BD-language"], nativeID: ["bn-bd-x-ban-network", "bn-bd-x-ban-local"], language: "bn-BD", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], l$w = {
  language: "bn",
  defaultRegion: e$G,
  testUtterance: n$B,
  voices: a$G
};

var bnBpn_lzoe = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: l$w,
  defaultRegion: e$G,
  language: o$x,
  testUtterance: n$B,
  voices: a$G
});

const n$A = "ca", a$F = "ca-ES", e$F = "Hola, em dic {name} i sóc una veu catalana", l$v = [{ label: "Joana (Català)", name: "Microsoft Joana Online (Natural) - Catalan", language: "ca-ES", otherLanguages: ["es"], gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Enric (Català)", name: "Microsoft Enric Online (Natural) - Catalan", language: "ca-ES", otherLanguages: ["es"], gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Montse (Català)", name: "Montse", localizedName: "apple", language: "ca-ES", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Pau (Valencià)", name: "Pau", localizedName: "apple", language: "ca-ES-u-sd-esvc", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Jordi (Català)", name: "Jordi", localizedName: "apple", language: "ca-ES", gender: "male", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Herena (Català)", name: "Microsoft Herena - Catalan (Spain)", language: "ca-ES", gender: "female", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Veu femenina catalana", name: "Android Speech Recognition and Synthesis from Google ca-es-x-caf-network", altNames: ["Android Speech Recognition and Synthesis from Google ca-es-x-caf-local", "Android Speech Recognition and Synthesis from Google ca-ES-language"], nativeID: ["ca-es-x-caf-network", "ca-es-x-caf-local"], language: "ca-ES", otherLanguages: ["es"], gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], o$w = {
  language: "ca",
  defaultRegion: a$F,
  testUtterance: e$F,
  voices: l$v
};

var ca5hzouNcE = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: o$w,
  defaultRegion: a$F,
  language: n$A,
  testUtterance: e$F,
  voices: l$v
});

const l$u = "cmn", a$E = "cmn-CN", e$E = "你好，我的名字是 {name}，我是普通话配音。", n$z = /* @__PURE__ */ JSON.parse(`[{"label":"Xiaoxiao","name":"Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)","language":"cmn-CN","altLanguage":"zh-CN","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Xiaoyi","name":"Microsoft Xiaoyi Online (Natural) - Chinese (Mainland)","language":"cmn-CN","altLanguage":"zh-CN","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Yunxi","name":"Microsoft Yunxi Online (Natural) - Chinese (Mainland)","language":"cmn-CN","altLanguage":"zh-CN","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Yunxia","name":"Microsoft Yunxia Online (Natural) - Chinese (Mainland)","language":"cmn-CN","altLanguage":"zh-CN","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Xiaobei","name":"Microsoft Xiaobei Online (Natural) - Chinese (Northeastern Mandarin)","language":"cmn-CN-liaoning","altLanguage":"zh-CN-liaoning","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Xiaoni","name":"Microsoft Xiaoni Online (Natural) - Chinese (Zhongyuan Mandarin Shaanxi)","language":"cmn-CN-shaanxi","altLanguage":"zh-CN-shaanxi","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Yunjian","name":"Microsoft Yunjian Online (Natural) - Chinese (Mainland)","language":"cmn-CN","altLanguage":"zh-CN","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Yunyang","name":"Microsoft Yunyang Online (Natural) - Chinese (Mainland)","language":"cmn-CN","altLanguage":"zh-CN","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"HsiaoChen","name":"Microsoft HsiaoChen Online (Natural) - Chinese (Taiwan)","language":"cmn-TW","altLanguage":"zh-TW","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"HsiaoYu","name":"Microsoft HsiaoYu Online (Natural) - Chinese (Taiwanese Mandarin)","language":"cmn-TW","altLanguage":"zh-TW","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"YunJhe","name":"Microsoft YunJhe Online (Natural) - Chinese (Taiwan)","language":"cmn-TW","altLanguage":"zh-TW","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Google 女声","name":"Google 普通话（中国大陆）","note":"This voice is pre-loaded in Chrome on desktop. Utterances that are longer than 14 seconds long can trigger a bug with this voice, check the notes in the project's README for more information.","language":"cmn-CN","altLanguage":"zh-CN","gender":"female","quality":["high"],"rate":1,"pitch":1,"controls":{"boundary":false},"browser":["ChromeDesktop"],"preloaded":true},{"label":"Google 女聲","name":"Google 國語（臺灣）","note":"This voice is pre-loaded in Chrome on desktop. Utterances that are longer than 14 seconds long can trigger a bug with this voice, check the notes in the project's README for more information.","language":"cmn-TW","altLanguage":"zh-TW","gender":"female","quality":["high"],"rate":1,"pitch":1,"controls":{"boundary":false},"browser":["ChromeDesktop"],"preloaded":true},{"label":"Lilian","name":"Lilian","localizedName":"apple","language":"cmn-CN","altLanguage":"zh-CN","gender":"female","quality":["normal","high"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Tiantian","name":"Tiantian","localizedName":"apple","language":"cmn-CN","altLanguage":"zh-CN","gender":"female","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Shasha","name":"Shasha","localizedName":"apple","language":"cmn-CN","altLanguage":"zh-CN","gender":"female","quality":["normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Lili","name":"Lili","localizedName":"apple","language":"cmn-CN","altLanguage":"zh-CN","gender":"female","quality":["low","normal","high"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Lisheng","name":"Lisheng","localizedName":"apple","language":"cmn-CN","altLanguage":"zh-CN","gender":"female","quality":["normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Lanlan","name":"Lanlan","localizedName":"apple","language":"cmn-CN","altLanguage":"zh-CN","gender":"female","quality":["normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Shanshan","name":"Shanshan","localizedName":"apple","language":"cmn-CN","altLanguage":"zh-CN","gender":"female","quality":["normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Yue","name":"Yue","localizedName":"apple","language":"cmn-CN","altLanguage":"zh-CN","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Tingting","name":"Tingting","localizedName":"apple","language":"cmn-CN","altLanguage":"zh-CN","gender":"female","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"],"preloaded":true},{"label":"Yu-shu","name":"Yu-shu","localizedName":"apple","language":"cmn-CN","altLanguage":"zh-CN","gender":"female","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"],"preloaded":true},{"label":"Dongmei","name":"Dongmei","localizedName":"apple","language":"cmn-CN-liaoning","altLanguage":"zh-CN-liaoning","gender":"female","quality":["normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Panpan","name":"Panpan","localizedName":"apple","language":"cmn-CN-sichuan","altLanguage":"zh-CN-sichuan","gender":"female","quality":["low","high"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Meijia","name":"Meijia","localizedName":"apple","language":"cmn-TW","altLanguage":"zh-TW","gender":"female","quality":["low","high"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Han","name":"Han","localizedName":"apple","language":"cmn-CN","altLanguage":"zh-CN","gender":"male","quality":["low","normal","high"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Bobo","name":"Bobo","localizedName":"apple","language":"cmn-CN","altLanguage":"zh-CN","gender":"male","quality":["normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Taotao","name":"Taotao","localizedName":"apple","language":"cmn-CN","altLanguage":"zh-CN","gender":"male","quality":["normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Binbin","name":"Binbin","localizedName":"apple","language":"cmn-CN","altLanguage":"zh-CN","gender":"male","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Li-Mu","name":"Li-Mu","localizedName":"apple","language":"cmn-CN","altLanguage":"zh-CN","gender":"male","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"],"preloaded":true},{"label":"Haohao","name":"Haohao","localizedName":"apple","language":"cmn-CN-shaanxi","altLanguage":"zh-CN-shaanxi","gender":"male","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"],"preloaded":true},{"label":"Huihui","name":"Microsoft Huihui - Chinese (Simplified, PRC)","language":"cmn-CN","altLanguage":"zh-CN","gender":"female","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Yaoyao","name":"Microsoft Yaoyao - Chinese (Simplified, PRC)","language":"cmn-CN","altLanguage":"zh-CN","gender":"female","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Kangkang","name":"Microsoft Kangkang - Chinese (Simplified, PRC)","language":"cmn-CN","altLanguage":"zh-CN","gender":"male","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Yating","name":"Microsoft Yating - Chinese (Traditional, Taiwan)","language":"cmn-TW","altLanguage":"zh-TW","gender":"female","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Hanhan","name":"Microsoft Hanhan - Chinese (Traditional, Taiwan)","language":"cmn-TW","altLanguage":"zh-TW","gender":"female","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Zhiwei","name":"Microsoft Zhiwei - Chinese (Traditional, Taiwan)","language":"cmn-TW","altLanguage":"zh-TW","gender":"male","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"女声1","name":"Android Speech Recognition and Synthesis from Google cmn-CN-x-ccc-network","altNames":["Android Speech Recognition and Synthesis from Google cmn-CN-x-ccc-local","Android Speech Recognition and Synthesis from Google zh-CN-language"],"nativeID":["cmn-CN-x-ccc-network","cmn-CN-x-ccc-local"],"language":"cmn-CN","altLanguage":"zh-CN","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"女声2","name":"Android Speech Recognition and Synthesis from Google cmn-CN-x-ssa-network","altNames":["Android Speech Recognition and Synthesis from Google cmn-CN-x-ssa-local"],"nativeID":["cmn-CN-x-ssa-network","cmn-CN-x-ssa-local"],"language":"cmn-CN","altLanguage":"zh-CN","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"男声1","name":"Android Speech Recognition and Synthesis from Google cmn-CN-x-ccd-network","altNames":["Android Speech Recognition and Synthesis from Google cmn-CN-x-ccd-local"],"nativeID":["cmn-CN-x-ccd-network","cmn-CN-x-ccd-local"],"language":"cmn-CN","altLanguage":"zh-CN","gender":"male","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"男声2","name":"Android Speech Recognition and Synthesis from Google cmn-CN-x-cce-network","altNames":["Android Speech Recognition and Synthesis from Google cmn-CN-x-cce-local"],"nativeID":["cmn-CN-x-cce-network","cmn-CN-x-cce-local"],"language":"cmn-CN","altLanguage":"zh-CN","gender":"male","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"女聲","name":"Android Speech Recognition and Synthesis from Google cmn-TW-x-ctc-network","altNames":["Android Speech Recognition and Synthesis from Google cmn-TW-x-ctc-local","Android Speech Recognition and Synthesis from Google zh-TW-language"],"nativeID":["cmn-TW-x-ctc-network","cmn-TW-x-ctc-local"],"language":"cmn-TW","altLanguage":"zh-TW","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"男聲1","name":"Android Speech Recognition and Synthesis from Google cmn-TW-x-ctd-network","altNames":["Chrome OS 粵語 1","Android Speech Recognition and Synthesis from Google cmn-TW-x-ctd-local"],"nativeID":["cmn-TW-x-ctd-network","cmn-TW-x-ctd-local"],"language":"cmn-TW","altLanguage":"zh-TW","gender":"male","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"男聲2","name":"Android Speech Recognition and Synthesis from Google cmn-TW-x-cte-network","altNames":["Chrome OS 粵語 1","Android Speech Recognition and Synthesis from Google cmn-TW-x-cte-local"],"nativeID":["cmn-TW-x-cte-network","cmn-TW-x-cte-local"],"language":"cmn-CTW","altLanguage":"zh-TW","gender":"male","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}}]`), o$v = {
  language: "cmn",
  defaultRegion: a$E,
  testUtterance: e$E,
  voices: n$z
};

var cmnDlnYMCd8 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: o$v,
  defaultRegion: a$E,
  language: l$u,
  testUtterance: e$E,
  voices: n$z
});

const n$y = "cs", e$D = "cs-CZ", a$D = "Dobrý den, jmenuji se {name} a jsem český hlas.", l$t = [{ label: "Vlasta", name: "Microsoft Vlasta Online (Natural) - Czech (Czech)", language: "cs-CZ", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Antonin", name: "Microsoft Antonin Online (Natural) - Czech (Czech)", language: "cs-CZ", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Zuzana", name: "Zuzana", localizedName: "apple", language: "cs-CZ", gender: "female", quality: ["low", "normal", "high"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Iveta", name: "Iveta", localizedName: "apple", language: "cs-CZ", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Jakub", name: "Microsoft Jakub - Czech (Czech)", language: "cs-CZ", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Ženský hlas", name: "Google čeština (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google cs-cz-x-jfs-network", "Chrome OS čeština", "Android Speech Recognition and Synthesis from Google cs-cz-x-jfs-local", "Android Speech Recognition and Synthesis from Google cs-CZ-language"], nativeID: ["cs-cz-x-jfs-network", "cs-cz-x-jfs-local"], language: "cs-CZ", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], o$u = {
  language: "cs",
  defaultRegion: e$D,
  testUtterance: a$D,
  voices: l$t
};

var csCDpMkMNO = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: o$u,
  defaultRegion: e$D,
  language: n$y,
  testUtterance: a$D,
  voices: l$t
});

const n$x = "da", e$C = "da-DK", a$C = "Hej, mit navn er {name} og jeg er en dansk stemme.", o$t = [{ label: "Christel", name: "Microsoft Christel Online (Natural) - Danish (Denmark)", language: "da-DK", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Jeppe", name: "Microsoft Jeppe Online (Natural) - Danish (Denmark)", language: "da-DK", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Sara", name: "Sara", localizedName: "apple", language: "da-DK", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Magnus", name: "Magnus", localizedName: "apple", language: "da-DK", gender: "male", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Helle", name: "Microsoft Helle - Danish (Denmark)", language: "da-DK", gender: "female", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Kvindestemme 1", name: "Google Dansk 1 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google da-dk-x-kfm-network", "Chrome OS Dansk 1", "Android Speech Recognition and Synthesis from Google da-dk-x-kfm-local", "Android Speech Recognition and Synthesis from Google da-DK-language"], nativeID: ["da-dk-x-kfm-network", "da-dk-x-kfm-local"], language: "da-DK", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Kvindestemme 2", name: "Google Dansk 3 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google da-dk-x-sfp-network", "Chrome OS Dansk 3", "Android Speech Recognition and Synthesis from Google da-dk-x-sfp-local"], nativeID: ["da-dk-x-sfp-network", "da-dk-x-sfp-local"], language: "da-DK", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Kvindestemme 3", name: "Google Dansk 4 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google da-dk-x-vfb-network", "Chrome OS Dansk 4", "Android Speech Recognition and Synthesis from Google da-dk-x-vfb-local"], nativeID: ["da-dk-x-vfb-network", "da-dk-x-vfb-local"], language: "da-DK", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Mandsstemme", name: "Google Dansk 2 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google da-dk-x-nmm-network", "Chrome OS Dansk 2", "Android Speech Recognition and Synthesis from Google da-dk-x-nmm-local"], nativeID: ["da-dk-x-nmm-network", "da-dk-x-nmm-local"], language: "da-DK", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], l$s = {
  language: "da",
  defaultRegion: e$C,
  testUtterance: a$C,
  voices: o$t
};

var daXWCfWAwB = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: l$s,
  defaultRegion: e$C,
  language: n$x,
  testUtterance: a$C,
  voices: o$t
});

const n$w = "de", e$B = "de-DE", a$B = "Hallo, mein Name ist {name} und ich bin eine deutsche Stimme.", l$r = [{ label: "Seraphina", name: "Microsoft SeraphinaMultilingual Online (Natural) - German (Germany)", language: "de-DE", multiLingual: true, gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Amala", name: "Microsoft Amala Online (Natural) - German (Germany)", language: "de-DE", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Katja", name: "Microsoft Katja Online (Natural) - German (Germany)", language: "de-DE", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Florian", name: "Microsoft FlorianMultilingual Online (Natural) - German (Germany)", language: "de-DE", multiLingual: true, gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Conrad", name: "Microsoft Conrad Online (Natural) - German (Germany)", language: "de-DE", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Killian", name: "Microsoft Killian Online (Natural) - German (Germany)", language: "de-DE", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Ingrid", name: "Microsoft Ingrid Online (Natural) - German (Austria)", language: "de-AT", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Jonas", name: "Microsoft Jonas Online (Natural) - German (Austria)", language: "de-AT", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Leni", name: "Microsoft Leni Online (Natural) - German (Switzerland)", language: "de-CH", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Jan", name: "Microsoft Jan Online (Natural) - German (Switzerland)", language: "de-CH", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Weibliche Google-Stimme", name: "Google Deutsch", note: "This voice is pre-loaded in Chrome on desktop. Utterances that are longer than 14 seconds long can trigger a bug with this voice, check the notes in the project's README for more information.", language: "de-DE", gender: "female", quality: ["high"], rate: 1, pitch: 1, controls: { boundary: false }, browser: ["ChromeDesktop"], preloaded: true }, { label: "Petra", name: "Petra", localizedName: "apple", language: "de-DE", gender: "female", quality: ["low", "normal", "high"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Anna", name: "Anna", localizedName: "apple", language: "de-DE", gender: "female", quality: ["low", "normal", "high"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Helena", name: "Helena", localizedName: "apple", note: "This is a compact version of a preloaded Siri voice on macOS.", language: "de-DE", gender: "female", quality: ["low"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Markus", name: "Markus", localizedName: "apple", language: "de-DE", gender: "male", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Viktor", name: "Viktor", localizedName: "apple", language: "de-DE", gender: "male", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Yannick", name: "Yannick", localizedName: "apple", language: "de-DE", gender: "male", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Martin", name: "Martin", localizedName: "apple", note: "This is a compact version of a preloaded Siri voice on macOS.", language: "de-DE", gender: "male", quality: ["low"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Hedda", name: "Microsoft Hedda - German (Germany)", language: "de-DE", gender: "female", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Katja", name: "Microsoft Katja - German (Germany)", language: "de-DE", gender: "female", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Stefan", name: "Microsoft Stefan - German (Germany)", language: "de-DE", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Michael", name: "Microsoft Michael - German (Austria)", language: "de-AT", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Karsten", name: "Microsoft Karsten - German (Switzerland)", language: "de-CH", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Weibliche Stimme 1 (Deutschland)", name: "Google Deutsch 2 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google de-de-x-dea-network", "Chrome OS Deutsch 2", "Android Speech Recognition and Synthesis from Google de-de-x-dea-local", "Android Speech Recognition and Synthesis from Google de-DE-language"], nativeID: ["de-de-x-dea-network", "de-de-x-dea-local"], language: "de-DE", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Weibliche Stimme 2 (Deutschland)", name: "Google Deutsch 1 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google de-de-x-nfh-network", "Chrome OS Deutsch 1", "Android Speech Recognition and Synthesis from Google de-de-x-nfh-local"], nativeID: ["de-de-x-nfh-network", "de-de-x-nfh-local"], language: "de-DE", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Männliche Stimme 1 (Deutschland)", name: "Google Deutsch 3 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google de-de-x-deb-network", "Chrome OS Deutsch 3", "Android Speech Recognition and Synthesis from Google de-de-x-deb-local"], nativeID: ["de-de-x-deb-network", "de-de-x-deb-local"], language: "de-DE", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Männliche Stimme 2 (Deutschland)", name: "Google Deutsch 4 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google de-de-x-deg-network", "Chrome OS Deutsch 4", "Android Speech Recognition and Synthesis from Google de-de-x-deg-local"], nativeID: ["de-de-x-deg-network", "de-de-x-deg-local"], language: "de-DE", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], r$9 = {
  language: "de",
  defaultRegion: e$B,
  testUtterance: a$B,
  voices: l$r
};

var deDU0USiOh = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: r$9,
  defaultRegion: e$B,
  language: n$w,
  testUtterance: a$B,
  voices: l$r
});

const o$s = "el", e$A = "el-GR", a$A = "Γεια σας, με λένε {name} και είμαι ελληνική φωνή.", l$q = [{ label: "Athina", name: "Microsoft Athina Online (Natural) - Greek (Greece)", language: "el-GR", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Nestoras", name: "Microsoft Nestoras Online (Natural) - Greek (Greece)", language: "el-GR", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Melina", name: "Melina", localizedName: "apple", language: "el-GR", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Nikos", name: "Nikos", localizedName: "apple", language: "el-GR", gender: "male", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Stefanos", name: "Microsoft Stefanos - Greek (Greece)", language: "el-GR", gender: "female", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Γυναικεία φωνή", name: "Google Ελληνικά (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google el-gr-x-vfz-network", "Chrome OS Ελληνικά", "Android Speech Recognition and Synthesis from Google el-gr-x-vfz-local", "Android Speech Recognition and Synthesis from Google el-GR-language"], nativeID: ["el-gr-x-vfz-network", "el-gr-x-vfz-local"], language: "el-GR", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], n$v = {
  language: "el",
  defaultRegion: e$A,
  testUtterance: a$A,
  voices: l$q
};

var elClBwbIAW = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: n$v,
  defaultRegion: e$A,
  language: o$s,
  testUtterance: a$A,
  voices: l$q
});

const n$u = "en", e$z = "en-US", a$z = "Hello, my name is {name} and I am an English voice.", l$p = /* @__PURE__ */ JSON.parse(`[{"label":"Emma","name":"Microsoft EmmaMultilingual Online (Natural) - English (United States)","altNames":["Microsoft Emma Online (Natural) - English (United States)"],"language":"en-US","multiLingual":true,"gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Microsoft Ava","name":"Microsoft AvaMultilingual Online (Natural) - English (United States)","altNames":["Microsoft Ava Online (Natural) - English (United States)"],"language":"en-US","multiLingual":true,"gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Jenny","name":"Microsoft Jenny Online (Natural) - English (United States)","language":"en-US","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Aria","name":"Microsoft Aria Online (Natural) - English (United States)","language":"en-US","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Michelle","name":"Microsoft Michelle Online (Natural) - English (United States)","language":"en-US","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Ana","name":"Microsoft Ana Online (Natural) - English (United States)","language":"en-US","gender":"female","children":true,"quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Andrew","name":"Microsoft AndrewMultilingual Online (Natural) - English (United States)","altNames":["Microsoft Andrew Online (Natural) - English (United States)"],"language":"en-US","multiLingual":true,"gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Brian","name":"Microsoft BrianMultilingual Online (Natural) - English (United States)","altNames":["Microsoft Brian Online (Natural) - English (United States)"],"language":"en-US","multiLingual":true,"gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Guy","name":"Microsoft Guy Online (Natural) - English (United States)","language":"en-US","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Eric","name":"Microsoft Eric Online (Natural) - English (United States)","language":"en-US","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Steffan","name":"Microsoft Steffan Online (Natural) - English (United States)","language":"en-US","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Christopher","name":"Microsoft Christopher Online (Natural) - English (United States)","language":"en-US","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Roger","name":"Microsoft Roger Online (Natural) - English (United States)","language":"en-US","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Sonia","name":"Microsoft Sonia Online (Natural) - English (United Kingdom)","language":"en-GB","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Libby","name":"Microsoft Libby Online (Natural) - English (United Kingdom)","language":"en-GB","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Maisie","name":"Microsoft Maisie Online (Natural) - English (United Kingdom)","language":"en-GB","gender":"female","children":true,"quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Ryan","name":"Microsoft Ryan Online (Natural) - English (United Kingdom)","language":"en-GB","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Thomas","name":"Microsoft Thomas Online (Natural) - English (United Kingdom)","language":"en-GB","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Natasha","name":"Microsoft Natasha Online (Natural) - English (Australia)","language":"en-AU","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Hayley","name":"Microsoft Hayley Online - English (Australia)","language":"en-AU","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"William","name":"Microsoft William Online (Natural) - English (Australia)","altNames":["Microsoft WilliamMultilingual Online (Natural) - English (Australia)"],"language":"en-AU","multiLingual":true,"gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Clara","name":"Microsoft Clara Online (Natural) - English (Canada)","language":"en-CA","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Heather","name":"Microsoft Heather Online - English (Canada)","language":"en-CA","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Liam","name":"Microsoft Liam Online (Natural) - English (Canada)","language":"en-CA","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Neerja","name":"Microsoft Neerja Online (Natural) - English (India)","altNames":["Microsoft Neerja Online (Natural) - English (India) (Preview)"],"language":"en-IN","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Prabhat","name":"Microsoft Prabhat Online (Natural) - English (India)","language":"en-IN","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Emily","name":"Microsoft Emily Online (Natural) - English (Ireland)","language":"en-IE","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Connor","name":"Microsoft Connor Online (Natural) - English (Ireland)","language":"en-IE","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Leah","name":"Microsoft Leah Online (Natural) - English (South Africa)","language":"en-ZA","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Luke","name":"Microsoft Luke Online (Natural) - English (South Africa)","language":"en-ZA","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Yan","name":"Microsoft Yan Online (Natural) - English (Hong Kong SAR)","language":"en-HK","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Sam","name":"Microsoft Sam Online (Natural) - English (Hongkong)","language":"en-HK","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Asilia","name":"Microsoft Asilia Online (Natural) - English (Kenya)","language":"en-KE","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Chilemba","name":"Microsoft Chilemba Online (Natural) - English (Kenya)","language":"en-KE","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Molly","name":"Microsoft Molly Online (Natural) - English (New Zealand)","language":"en-NZ","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Mitchell","name":"Microsoft Mitchell Online (Natural) - English (New Zealand)","language":"en-NZ","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Ezinne","name":"Microsoft Ezinne Online (Natural) - English (Nigeria)","language":"en-NG","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Abeo","name":"Microsoft Abeo Online (Natural) - English (Nigeria)","language":"en-NG","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Rosa","name":"Microsoft Rosa Online (Natural) - English (Philippines)","language":"en-PH","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"James","name":"Microsoft James Online (Natural) - English (Philippines)","language":"en-PH","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Luna","name":"Microsoft Luna Online (Natural) - English (Singapore)","language":"en-SG","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Wayne","name":"Microsoft Wayne Online (Natural) - English (Singapore)","language":"en-SG","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Imani","name":"Microsoft Imani Online (Natural) - English (Tanzania)","language":"en-TZ","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Elimu","name":"Microsoft Elimu Online (Natural) - English (Tanzania)","language":"en-TZ","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Female Google voice (US)","name":"Google US English","note":"This voice is pre-loaded in Chrome on desktop. Utterances that are longer than 14 seconds long can trigger a bug with this voice, check the notes in the project's README for more information.","language":"en-US","gender":"female","quality":["high"],"rate":1,"pitch":1,"controls":{"boundary":false},"browser":["ChromeDesktop"],"preloaded":true},{"label":"Female Google voice (UK)","name":"Google UK English Female","note":"This voice is pre-loaded in Chrome on desktop. Utterances that are longer than 14 seconds long can trigger a bug with this voice, check the notes in the project's README for more information.","language":"en-GB","gender":"female","quality":["high"],"rate":1,"pitch":1,"controls":{"boundary":false},"browser":["ChromeDesktop"],"preloaded":true},{"label":"Male Google voice (UK)","name":"Google UK English Male","note":"This voice is pre-loaded in Chrome on desktop. Utterances that are longer than 14 seconds long can trigger a bug with this voice, check the notes in the project's README for more information.","language":"en-GB","gender":"male","quality":["high"],"rate":1,"pitch":1,"controls":{"boundary":false},"browser":["ChromeDesktop"],"preloaded":true},{"label":"Apple Ava","name":"Ava","localizedName":"apple","language":"en-US","gender":"female","quality":["low","normal","high"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Zoe","name":"Zoe","localizedName":"apple","language":"en-US","gender":"female","quality":["low","normal","high"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Allison","name":"Allison","localizedName":"apple","language":"en-US","gender":"female","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Nicky","name":"Nicky","localizedName":"apple","note":"This is a compact version of a preloaded Siri voice on macOS. Unlike other Siri voices, a higher quality version can be installed and used.","language":"en-US","gender":"female","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"],"preloaded":true},{"label":"Samantha","name":"Samantha","localizedName":"apple","language":"en-US","gender":"female","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"],"preloaded":true},{"label":"Joelle","name":"Joelle","localizedName":"apple","language":"en-US","gender":"female","children":true,"quality":["normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Evan","name":"Evan","localizedName":"apple","language":"en-US","gender":"male","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Nathan","name":"Nathan","localizedName":"apple","language":"en-US","gender":"male","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Tom","name":"Tom","localizedName":"apple","language":"en-US","gender":"male","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Alex","name":"Alex","localizedName":"apple","language":"en-US","gender":"male","quality":["high"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Aaron","name":"Aaron","localizedName":"apple","note":"This is a compact version of a preloaded Siri voice on macOS.","language":"en-US","gender":"male","quality":["low"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"],"preloaded":true},{"label":"Kate","name":"Kate","localizedName":"apple","language":"en-GB","gender":"female","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Stephanie","name":"Stephanie","localizedName":"apple","language":"en-GB","gender":"female","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Serena","name":"Serena","localizedName":"apple","language":"en-GB","gender":"female","quality":["low","normal","high"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Martha","name":"Martha","localizedName":"apple","note":"This is a compact version of a preloaded Siri voice on macOS.","language":"en-GB","gender":"female","quality":["low"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"],"preloaded":true},{"label":"Jamie","name":"Jamie","localizedName":"apple","language":"en-GB","gender":"male","quality":["low","normal","high"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Oliver","name":"Oliver","localizedName":"apple","language":"en-GB","gender":"male","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Daniel","name":"Daniel","localizedName":"apple","language":"en-GB","gender":"male","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"],"preloaded":true},{"label":"Arthur","name":"Arthur","localizedName":"apple","note":"This is a compact version of a preloaded Siri voice on macOS.","language":"en-GB","gender":"male","quality":["low"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"],"preloaded":true},{"label":"Matilda","name":"Matilda","localizedName":"apple","language":"en-AU","gender":"female","quality":["low","normal","high"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Karen","name":"Karen","localizedName":"apple","language":"en-AU","gender":"female","quality":["low","normal","high"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"],"preloaded":true},{"label":"Catherine","name":"Catherine","localizedName":"apple","note":"This is a compact version of a preloaded Siri voice on macOS.","language":"en-AU","gender":"female","quality":["low"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"],"preloaded":true},{"label":"Lee","name":"Lee","localizedName":"apple","language":"en-AU","gender":"male","quality":["low","normal","high"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Gordon","name":"Gordon","localizedName":"apple","note":"This is a compact version of a preloaded Siri voice on macOS.","language":"en-AU","gender":"male","quality":["low"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"],"preloaded":true},{"label":"Aman","name":"Aman","nativeID":["com.apple.voice.Aman"],"localizedName":"apple","language":"en-IN","gender":"male","quality":["high"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Tara","name":"Tara","nativeID":["com.apple.voice.Tara"],"localizedName":"apple","language":"en-IN","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Isha","name":"Isha","localizedName":"apple","language":"en-IN","gender":"female","quality":["low","normal","high"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Sangeeta","name":"Sangeeta","localizedName":"apple","language":"en-IN","gender":"female","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Veena ","name":"Veena","localizedName":"apple","language":"en-IN","gender":"female","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Rishi","name":"Rishi","localizedName":"apple","language":"en-IN","gender":"male","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"],"preloaded":true},{"label":"Moira","name":"Moira","localizedName":"apple","language":"en-IE","gender":"female","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Tessa","name":"Tessa","localizedName":"apple","language":"en-ZA","gender":"female","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Fiona","name":"Fiona","localizedName":"apple","language":"en-GB-u-sd-gbsct","gender":"female","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Zira","name":"Microsoft Zira - English (United States)","language":"en-US","gender":"female","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"David","name":"Microsoft David - English (United States)","language":"en-US","gender":"male","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Mark","name":"Microsoft Mark - English (United States)","language":"en-US","gender":"male","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Hazel","name":"Microsoft Hazel - English (Great Britain)","language":"en-GB","gender":"female","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Susan","name":"Microsoft Susan - English (Great Britain)","language":"en-GB","gender":"female","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"George","name":"Microsoft George - English (Great Britain)","language":"en-GB","gender":"male","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Catherine","name":"Microsoft Catherine - English (Austalia)","language":"en-AU","gender":"female","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"James","name":"Microsoft Richard - English (Australia)","language":"en-AU","gender":"male","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Linda","name":"Microsoft Linda - English (Canada)","language":"en-CA","gender":"female","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Richard","name":"Microsoft Richard - English (Canada)","language":"en-CA","gender":"male","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Heera","name":"Microsoft Heera - English (India)","language":"en-IN","gender":"female","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Ravi","name":"Microsoft Ravi - English (India)","language":"en-IN","gender":"male","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Sean","name":"Microsoft Sean - English (Ireland)","language":"en-IE","gender":"male","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Female voice 1 (US)","name":"Google US English 5 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google en-us-x-tpc-network","Chrome OS US English 5","Android Speech Recognition and Synthesis from Google en-us-x-tpc-local","Android Speech Recognition and Synthesis from Google en-US-language"],"nativeID":["en-us-x-tpc-network","en-us-x-tpc-local"],"language":"en-US","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Female voice 2 (US)","name":"Google US English 1 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google en-us-x-iob-network","Chrome OS US English 1","Android Speech Recognition and Synthesis from Google en-us-x-iob-local"],"nativeID":["en-us-x-iob-network","en-us-x-iob-local"],"language":"en-US","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Female voice 3 (US)","name":"Google US English 2 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google en-us-x-iog-network","Chrome OS US English 2","Android Speech Recognition and Synthesis from Google en-us-x-iog-local"],"nativeID":["en-us-x-iog-network","en-us-x-iog-local"],"language":"en-US","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Female voice 4 (US)","name":"Google US English 7 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google en-us-x-tpf-network","Chrome OS US English 7","Android Speech Recognition and Synthesis from Google en-us-x-tpf-local"],"nativeID":["en-us-x-tpf-network","en-us-x-tpf-local"],"language":"en-US","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Female voice 5 (US)","name":"Android Speech Recognition and Synthesis from Google en-us-x-sfg-network","altNames":["Android Speech Recognition and Synthesis from Google en-us-x-sfg-local"],"nativeID":["en-us-x-sfg-network","en-us-x-sfg-local"],"language":"en-US","gender":"female","quality":["normal"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Female voice 6 (US)","name":"Chrome OS US English 8","language":"en-US","gender":"female","quality":["low"],"rate":1,"pitch":1,"os":["ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Male voice 1 (US)","name":"Google US English 4 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google en-us-x-iom-network","Chrome OS US English 4","Android Speech Recognition and Synthesis from Google en-us-x-iom-local"],"nativeID":["en-us-x-iom-network","en-us-x-iom-local"],"language":"en-US","gender":"male","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Male voice 2 (US)","name":"Google US English 3 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google en-us-x-iol-network","Chrome OS US English 3","Android Speech Recognition and Synthesis from Google en-us-x-iol-local"],"nativeID":["en-us-x-iol-network","en-us-x-iol-local"],"language":"en-US","gender":"male","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Male voice 3 (US)","name":"Google US English 6 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google en-us-x-tpd-network","Chrome OS US English 6","Android Speech Recognition and Synthesis from Google en-us-x-tpd-local"],"nativeID":["en-us-x-tpd-network","en-us-x-tpd-local"],"language":"en-US","gender":"male","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Female voice 1 (UK)","name":"Google UK English 2 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google en-gb-x-gba-network","Chrome OS UK English 2","Android Speech Recognition and Synthesis from Google en-gb-x-gba-local","Android Speech Recognition and Synthesis from Google en-GB-language"],"nativeID":["en-gb-x-gba-network","en-gb-x-gba-local"],"language":"en-GB","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Female voice 2 (UK)","name":"Google UK English 4 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google en-gb-x-gbc-network","Chrome OS UK English 4","Android Speech Recognition and Synthesis from Google en-gb-x-gbc-local"],"nativeID":["en-gb-x-gbc-network","en-gb-x-gbc-local"],"language":"en-GB","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Female voice 3 (UK)","name":"Google UK English 6 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google en-gb-x-gbg-network","Chrome OS UK English 6","Android Speech Recognition and Synthesis from Google en-gb-x-gbg-local"],"nativeID":["en-gb-x-gbg-network","en-gb-x-gbg-local"],"language":"en-GB","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Female voice 4 (UK)","name":"Chrome OS UK English 7","language":"en-GB","gender":"female","quality":["low"],"rate":1,"pitch":1,"os":["ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Male voice 1 (UK)","name":"Google UK English 1 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google en-gb-x-rjs-network","Chrome OS UK English 1","Android Speech Recognition and Synthesis from Google en-gb-x-rjs-local"],"nativeID":["en-gb-x-rjs-network","en-gb-x-rjs-local"],"language":"en-GB","gender":"male","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Male voice 2 (UK)","name":"Google UK English 3 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google en-gb-x-gbb-network","Chrome OS UK English 3","Android Speech Recognition and Synthesis from Google en-gb-x-gbb-local"],"nativeID":["en-gb-x-gbb-network","en-gb-x-gbb-local"],"language":"en-GB","gender":"male","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Male voice 3 (UK)","name":"Google UK English 5 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google en-gb-x-gbd-network","Chrome OS UK English 5","Android Speech Recognition and Synthesis from Google en-gb-x-gbd-local"],"nativeID":["en-gb-x-gbd-network","en-gb-x-gbd-local"],"language":"en-GB","gender":"male","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Female voice 1 (Australia)","name":"Google Australian English 1 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google en-au-x-aua-network","Chrome OS Australian English 1","Android Speech Recognition and Synthesis from Google en-au-x-aua-local","Android Speech Recognition and Synthesis from Google en-AU-language"],"nativeID":["en-au-x-aua-network","en-au-x-aua-local"],"language":"en-AU","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Female voice 2 (Australia)","name":"Google Australian English 3 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google en-au-x-auc-network","Chrome OS Australian English 3","Android Speech Recognition and Synthesis from Google en-au-x-auc-local"],"nativeID":["en-au-x-auc-network","en-au-x-auc-local"],"language":"en-AU","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Male voice 1 (Australia)","name":"Google Australian English 2 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google en-au-x-aub-network","Chrome OS Australian English 2","Android Speech Recognition and Synthesis from Google en-au-x-aub-local"],"nativeID":["en-au-x-aub-network","en-au-x-aub-local"],"language":"en-AU","gender":"male","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Male voice 2 (Australia)","name":"Google Australian English 4 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google en-au-x-aud-network","Chrome OS Australian English 4","Android Speech Recognition and Synthesis from Google en-au-x-aud-local"],"nativeID":["en-au-x-aud-network","en-au-x-aud-local"],"language":"en-AU","gender":"male","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Male voice 3 (Australia)","name":"Chrome OS Australian English 5","language":"en-AU","gender":"male","quality":["high"],"rate":1,"pitch":1,"os":["ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Female voice 1 (India)","name":"Android Speech Recognition and Synthesis from Google en-in-x-ena-network","altNames":["Android Speech Recognition and Synthesis from Google en-in-x-ena-local","Android Speech Recognition and Synthesis from Google en-IN-language"],"nativeID":["en-in-x-ena-network","en-in-x-ena-local"],"language":"en-IN","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Female voice 2 (India)","name":"Android Speech Recognition and Synthesis from Google en-in-x-enc-network","altNames":["Android Speech Recognition and Synthesis from Google en-in-x-enc-local"],"nativeID":["en-in-x-enc-network","en-in-x-enc-local"],"language":"en-IN","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Male voice 1 (India)","name":"Android Speech Recognition and Synthesis from Google en-in-x-end-network","altNames":["Android Speech Recognition and Synthesis from Google en-in-x-end-local"],"nativeID":["en-in-x-end-network","en-in-x-end-local"],"language":"en-IN","gender":"male","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Male voice 2 (India)","name":"Android Speech Recognition and Synthesis from Google en-in-x-ene-network","altNames":["Android Speech Recognition and Synthesis from Google en-in-x-ene-local"],"nativeID":["en-in-x-ene-network","en-in-x-ene-local"],"language":"en-IN","gender":"male","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}}]`), o$r = {
  language: "en",
  defaultRegion: e$z,
  testUtterance: a$z,
  voices: l$p
};

var enL3wcpTw3 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: o$r,
  defaultRegion: e$z,
  language: n$u,
  testUtterance: a$z,
  voices: l$p
});

const o$q = "es", e$y = "es-ES", a$y = "Hola, mi nombre es {name} y soy una voz española.", l$o = /* @__PURE__ */ JSON.parse(`[{"label":"Elvira","name":"Microsoft Elvira Online (Natural) - Spanish (Spain)","language":"es-ES","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Alvaro","name":"Microsoft Alvaro Online (Natural) - Spanish (Spain)","language":"es-ES","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Dalia","name":"Microsoft Dalia Online (Natural) - Spanish (Mexico)","language":"es-MX","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Microsoft Jorge","name":"Microsoft Jorge Online (Natural) - Spanish (Mexico)","language":"es-MX","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Elena","name":"Microsoft Elena Online (Natural) - Spanish (Argentina)","language":"es-AR","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Tomas","name":"Microsoft Tomas Online (Natural) - Spanish (Argentina)","language":"es-AR","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Sofia","name":"Microsoft Sofia Online (Natural) - Spanish (Bolivia)","language":"es-BO","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Marcelo","name":"Microsoft Marcelo Online (Natural) - Spanish (Bolivia)","language":"es-BO","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Catalina","name":"Microsoft Catalina Online (Natural) - Spanish (Chile)","language":"es-CL","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Lorenzo","name":"Microsoft Lorenzo Online (Natural) - Spanish (Chile)","language":"es-CL","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Ximena","name":"Microsoft Ximena Online (Natural) - Spanish (Colombia)","language":"es-CO","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Salome","name":"Microsoft Salome Online (Natural) - Spanish (Colombia)","language":"es-CO","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Gonzalo","name":"Microsoft Gonzalo Online (Natural) - Spanish (Colombia)","language":"es-CO","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Maria","name":"Microsoft Maria Online (Natural) - Spanish (Costa Rica)","language":"es-CR","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Juan","name":"Microsoft Juan Online (Natural) - Spanish (Costa Rica)","language":"es-CR","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Belkys","name":"Microsoft Belkys Online (Natural) - Spanish (Cuba)","language":"es-CU","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Manuel","name":"Microsoft Manuel Online (Natural) - Spanish (Cuba)","language":"es-CU","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Andrea","name":"Microsoft Andrea Online (Natural) - Spanish (Ecuador)","language":"es-EC","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Luis","name":"Microsoft Luis Online (Natural) - Spanish (Ecuador)","language":"es-EC","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Lorena","name":"Microsoft Lorena Online (Natural) - Spanish (El Salvador)","language":"es-SV","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Rodrigo","name":"Microsoft Rodrigo Online (Natural) - Spanish (El Salvador)","language":"es-SV","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Paloma","name":"Microsoft Paloma Online (Natural) - Spanish (United States)","language":"es-US","otherLanguages":["en"],"gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Alonso","name":"Microsoft Alonso Online (Natural) - Spanish (United States)","language":"es-US","otherLanguages":["en"],"gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Marta","name":"Microsoft Marta Online (Natural) - Spanish (Guatemala)","language":"es-GT","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Andres","name":"Microsoft Andres Online (Natural) - Spanish (Guatemala)","language":"es-GT","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Teresa","name":"Microsoft Teresa Online (Natural) - Spanish (Equatorial Guinea)","language":"es-GQ","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Javier","name":"Microsoft Javier Online (Natural) - Spanish (Equatorial Guinea)","language":"es-GQ","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Karla","name":"Microsoft Karla Online (Natural) - Spanish (Honduras)","language":"es-HN","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Carlos","name":"Microsoft Carlos Online (Natural) - Spanish (Honduras)","language":"es-HN","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Yolanda","name":"Microsoft Yolanda Online (Natural) - Spanish (Nicaragua)","language":"es-NI","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Federico","name":"Microsoft Federico Online (Natural) - Spanish (Nicaragua)","language":"es-NI","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Margarita","name":"Microsoft Margarita Online (Natural) - Spanish (Panama)","language":"es-PA","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Roberto","name":"Microsoft Roberto Online (Natural) - Spanish (Panama)","language":"es-PA","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Tania","name":"Microsoft Tania Online (Natural) - Spanish (Paraguay)","language":"es-PY","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Mario","name":"Microsoft Mario Online (Natural) - Spanish (Paraguay)","language":"es-PY","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Camila","name":"Microsoft Camila Online (Natural) - Spanish (Peru)","language":"es-PE","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Alex","name":"Microsoft Alex Online (Natural) - Spanish (Peru)","language":"es-PE","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Karina","name":"Microsoft Karina Online (Natural) - Spanish (Puerto Rico)","language":"es-PR","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Victor","name":"Microsoft Victor Online (Natural) - Spanish (Puerto Rico)","language":"es-PR","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Ramona","name":"Microsoft Ramona Online (Natural) - Spanish (Dominican Republic)","language":"es-DO","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Emilio","name":"Microsoft Emilio Online (Natural) - Spanish (Dominican Republic)","language":"es-DO","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Valentina","name":"Microsoft Valentina Online (Natural) - Spanish (Uruguay)","language":"es-UY","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Mateo","name":"Microsoft Mateo Online (Natural) - Spanish (Uruguay)","language":"es-UY","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Paola","name":"Microsoft Paola Online (Natural) - Spanish (Venezuela)","language":"es-VE","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Sebastian","name":"Microsoft Sebastian Online (Natural) - Spanish (Venezuela)","language":"es-VE","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Voz Google masculina (España)","name":"Google español","note":"This voice is pre-loaded in Chrome on desktop. Utterances that are longer than 14 seconds long can trigger a bug with this voice, check the notes in the project's README for more information.","language":"es-ES","gender":"male","quality":["high"],"rate":1,"pitch":1,"controls":{"boundary":false},"browser":["ChromeDesktop"],"preloaded":true},{"label":"Voz Google femenina (Estados Unidos)","name":"Google español de Estados Unidos","note":"This voice is pre-loaded in Chrome on desktop. Utterances that are longer than 14 seconds long can trigger a bug with this voice, check the notes in the project's README for more information.","language":"es-US","gender":"female","quality":["high"],"rate":1,"pitch":1,"controls":{"boundary":false},"browser":["ChromeDesktop"],"preloaded":true},{"label":"Marisol","name":"Marisol","localizedName":"apple","language":"es-ES","gender":"female","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Mónica","name":"Mónica","localizedName":"apple","language":"es-ES","gender":"female","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"],"preloaded":true},{"label":"Apple Jorge","name":"Jorge","localizedName":"apple","language":"es-ES","gender":"male","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Angelica","name":"Angelica","localizedName":"apple","language":"es-MX","gender":"female","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Paulina","name":"Paulina","localizedName":"apple","language":"es-MX","gender":"female","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"],"preloaded":true},{"label":"Juan","name":"Juan","localizedName":"apple","language":"es-MX","gender":"male","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Isabela","name":"Isabela","localizedName":"apple","language":"es-AR","gender":"female","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Diego","name":"Diego","localizedName":"apple","language":"es-AR","gender":"male","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Francisca","name":"Francisca","nativeID":["com.apple.voice.enhanced.es-CL.Francisca"],"localizedName":"apple","language":"es-CL","gender":"female","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Soledad","name":"Soledad","localizedName":"apple","language":"es-CO","gender":"female","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Jimena","name":"Jimena","localizedName":"apple","language":"es-CO","gender":"female","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Carlos","name":"Carlos","localizedName":"apple","language":"es-CO","gender":"male","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Helena","name":"Microsoft Helena - Spanish (Spain)","language":"es-ES","gender":"female","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Laura","name":"Microsoft Laura - Spanish (Spain)","language":"es-ES","gender":"female","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Pablo","name":"Microsoft Pablo - Spanish (Spain)","language":"es-ES","gender":"male","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Sabina","name":"Microsoft Sabina - Spanish (Mexico)","language":"es-MX","gender":"female","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Raul","name":"Microsoft Raul - Spanish (Mexico)","language":"es-MX","gender":"male","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Voz femenina 1 (España)","name":"Google español 4 (Natural)","altNames":["Chrome OS español 4","Android Speech Recognition and Synthesis from Google es-es-x-eee-local","Android Speech Recognition and Synthesis from Google es-ES-language"],"nativeID":["es-es-x-eee-local"],"language":"es-ES","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Voz femenina 2 (España)","name":"Google español 1 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google es-es-x-eea-network","Chrome OS español 1","Android Speech Recognition and Synthesis from Google es-es-x-eea-local"],"nativeID":["es-es-x-eea-network","es-es-x-eea-local"],"language":"es-ES","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Voz femenina 3 (España)","name":"Google español 2 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google es-es-x-eec-network","Chrome OS español 2","Android Speech Recognition and Synthesis from Google es-es-x-eec-local"],"nativeID":["es-es-x-eec-network","es-es-x-eec-local"],"language":"es-ES","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Voz masculina 1 (España)","name":"Google español 3 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google es-es-x-eed-network","Chrome OS español 3","Android Speech Recognition and Synthesis from Google es-es-x-eed-local"],"nativeID":["es-es-x-eed-network","es-es-x-eed-local"],"language":"es-ES","gender":"male","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Voz masculina 2 (España)","name":"Google español 5 (Natural)","altNames":["Chrome OS español 5","Android Speech Recognition and Synthesis from Google es-es-x-eef-local"],"nativeID":["es-es-x-eef-local"],"language":"es-ES","gender":"male","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Voz femenina 1 (Estados Unidos)","name":"Google español de Estados Unidos 1 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google es-us-x-esc-network","Chrome OS español de Estados Unidos","Android Speech Recognition and Synthesis from Google es-us-x-esc-local","Android Speech Recognition and Synthesis from Google es-US-language"],"nativeID":["es-us-x-esc-network","es-us-x-esc-local"],"language":"es-US","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Voz femenina 2 (Estados Unidos)","name":"Google español de Estados Unidos 2 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google es-us-x-sfb-network","Android Speech Recognition and Synthesis from Google es-us-x-sfb-local"],"nativeID":["es-us-x-sfb-network","es-us-x-sfb-local"],"language":"es-US","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Voz masculina 1 (Estados Unidos)","name":"Google español de Estados Unidos 3 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google es-us-x-esd-network","Android Speech Recognition and Synthesis from Google es-us-x-esd-local"],"nativeID":["es-us-x-esd-network","es-us-x-esd-local"],"language":"es-US","gender":"male","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Voz masculina 2 (Estados Unidos)","name":"Google español de Estados Unidos 4 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google es-us-x-esf-network","Android Speech Recognition and Synthesis from Google es-us-x-esf-local"],"nativeID":["es-us-x-esf-network","es-us-x-esf-local"],"language":"es-US","gender":"male","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}}]`), r$8 = {
  language: "es",
  defaultRegion: e$y,
  testUtterance: a$y,
  voices: l$o
};

var esDwOFJY07 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: r$8,
  defaultRegion: e$y,
  language: o$q,
  testUtterance: a$y,
  voices: l$o
});

const t$7 = "eu", e$x = "eu-ES", a$x = "Kaixo, nire izena {name} da eta euskal ahotsa naiz.", n$t = [{ label: "Miren", name: "Miren", localizedName: "apple", language: "eu-ES", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }], l$n = {
  language: "eu",
  defaultRegion: e$x,
  testUtterance: a$x,
  voices: n$t
};

var euDxWirHU_ = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: l$n,
  defaultRegion: e$x,
  language: t$7,
  testUtterance: a$x,
  voices: n$t
});

const r$7 = "fa", a$w = "fa-IR", e$w = "سلام اسم من {name} و صدای فارسی هستم", l$m = [{ label: "Dilara", name: "Microsoft Dilara Online (Natural) - Persian (Iran)", language: "fa-IR", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Farid", name: "Microsoft Farid Online (Natural) - Persian (Iran)", language: "fa-IR", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Dariush", name: "Dariush", localizedName: "apple", language: "fa-IR", gender: "male", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }], n$s = {
  language: "fa",
  defaultRegion: a$w,
  testUtterance: e$w,
  voices: l$m
};

var faMl9KtIw1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: n$s,
  defaultRegion: a$w,
  language: r$7,
  testUtterance: e$w,
  voices: l$m
});

const n$r = "fi", e$v = "fi-FI", a$v = "Hei, nimeni on {name} ja olen suomalainen ääni.", i$4 = [{ label: "Noora", name: "Microsoft Noora Online (Natural) - Finnish (Finland)", language: "fi-FI", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Harri", name: "Microsoft Harri Online (Natural) - Finnish (Finland)", language: "fi-FI", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Satu", name: "Satu", localizedName: "apple", language: "fi-FI", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Onni", name: "Onni", localizedName: "apple", language: "fi-FI", gender: "male", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Heidi", name: "Microsoft Heidi - Finnish (Finland)", language: "fi-FI", gender: "female", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Suomalainen naisääni", name: "Google Suomi (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google fi-fi-x-afi-network", "Chrome OS Suomi", "Android Speech Recognition and Synthesis from Google fi-fi-x-afi-local", "Android Speech Recognition and Synthesis from Google fi-FI-language"], nativeID: ["fi-fi-x-afi-network", "fi-fi-x-afi-local"], language: "fi-FI", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], l$l = {
  language: "fi",
  defaultRegion: e$v,
  testUtterance: a$v,
  voices: i$4
};

var fiDk5Fhhl = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: l$l,
  defaultRegion: e$v,
  language: n$r,
  testUtterance: a$v,
  voices: i$4
});

const l$k = "fr", e$u = "fr-FR", a$u = "Bonjour, mon nom est {name} et je suis une voix française.", r$6 = /* @__PURE__ */ JSON.parse(`[{"label":"Vivienne","name":"Microsoft VivienneMultilingual Online (Natural) - French (France)","language":"fr-FR","multiLingual":true,"gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Denise","name":"Microsoft Denise Online (Natural) - French (France)","language":"fr-FR","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Charline","name":"Microsoft Charline Online (Natural) - French (Belgium)","language":"fr-BE","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Ariane","name":"Microsoft Ariane Online (Natural) - French (Switzerland)","language":"fr-CH","gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Eloise","name":"Microsoft Eloise Online (Natural) - French (France)","language":"fr-FR","gender":"female","children":true,"quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Remy","name":"Microsoft RemyMultilingual Online (Natural) - French (France)","language":"fr-FR","multiLingual":true,"gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Henri","name":"Microsoft Henri Online (Natural) - French (France)","language":"fr-FR","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Gerard","name":"Microsoft Gerard Online (Natural) - French (Belgium)","language":"fr-BE","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Fabrice","name":"Microsoft Fabrice Online (Natural) - French (Switzerland)","language":"fr-CH","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Sylvie","name":"Microsoft Sylvie Online (Natural) - French (Canada)","language":"fr-CA","otherLanguages":["en"],"gender":"female","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Antoine","name":"Microsoft Antoine Online (Natural) - French (Canada)","language":"fr-CA","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Jean","name":"Microsoft Jean Online (Natural) - French (Canada)","language":"fr-CA","gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Thierry","name":"Microsoft Thierry Online (Natural) - French (Canada)","language":"fr-CA","otherLanguages":["en"],"gender":"male","quality":["veryHigh"],"rate":1,"browser":["Edge"],"preloaded":true,"controls":{"pitch":false,"boundary":false}},{"label":"Voix Google féminine (France)","name":"Google français","note":"This voice is pre-loaded in Chrome on desktop. Utterances that are longer than 14 seconds long can trigger a bug with this voice, check the notes in the project's README for more information.","language":"fr-FR","gender":"female","quality":["high"],"rate":1,"pitch":1,"controls":{"boundary":false},"browser":["ChromeDesktop"],"preloaded":true},{"label":"Audrey","name":"Audrey","localizedName":"apple","language":"fr-FR","gender":"female","quality":["low","normal","high"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Aurélie","name":"Aurélie","localizedName":"apple","language":"fr-FR","gender":"female","quality":["low","normal"],"rate":0.9,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Marie","name":"Marie","localizedName":"apple","note":"This is a compact version of a preloaded Siri voice on macOS.","language":"fr-FR","gender":"female","quality":["low"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"],"preloaded":true},{"label":"Thomas","name":"Thomas","localizedName":"apple","language":"fr-FR","gender":"male","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"],"preloaded":true},{"label":"Aude","name":"Aude","localizedName":"apple","language":"fr-BE","gender":"female","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Chantal","name":"Chantal","localizedName":"apple","language":"fr-CA","gender":"female","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Amélie","name":"Amélie","localizedName":"apple","language":"fr-CA","gender":"female","quality":["low","high"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"],"preloaded":true},{"label":"Nicolas","name":"Nicolas","localizedName":"apple","language":"fr-CA","gender":"male","quality":["low","normal"],"rate":1,"pitch":1,"os":["macOS","iOS","iPadOS"]},{"label":"Julie","name":"Microsoft Julie - French (France)","language":"fr-FR","gender":"female","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Hortence","name":"Microsoft Hortence - French (France)","language":"fr-FR","gender":"female","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Paul","name":"Microsoft Paul - French (France)","language":"fr-FR","gender":"male","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Caroline","name":"Microsoft Caroline - French (Canada)","language":"fr-CA","gender":"female","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Claude","name":"Microsoft Claude - French (Canada)","language":"fr-CA","gender":"male","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Guillaume","name":"Microsoft Claude - French (Switzerland)","language":"fr-CH","gender":"male","quality":["normal"],"rate":1,"pitch":1,"os":["Windows"],"preloaded":true},{"label":"Voix féminine 1 (France)","name":"Google français 4 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google fr-fr-x-frc-network","Chrome OS français 4","Android Speech Recognition and Synthesis from Google fr-fr-x-frc-local","Android Speech Recognition and Synthesis from Google fr-FR-language"],"nativeID":["fr-fr-x-frc-network","fr-fr-x-frc-local"],"language":"fr-FR","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Voix féminine 2 (France)","name":"Google français 2 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google fr-fr-x-fra-network","Chrome OS français 2","Android Speech Recognition and Synthesis from Google fr-fr-x-fra-local"],"nativeID":["fr-fr-x-fra-network","fr-fr-x-fra-local"],"language":"fr-FR","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Voix féminine 3 (France)","name":"Google français 1 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google fr-fr-x-vlf-network","Chrome OS français 1","Android Speech Recognition and Synthesis from Google fr-fr-x-vlf-local"],"nativeID":["fr-fr-x-vlf-network","fr-fr-x-vlf-local"],"language":"fr-FR","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Voix masculine 1 (France)","name":"Google français 5 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google fr-fr-x-frd-network","Chrome OS français 5","Android Speech Recognition and Synthesis from Google fr-fr-x-frd-local"],"nativeID":["fr-fr-x-frd-network","fr-fr-x-frd-local"],"language":"fr-FR","gender":"male","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Voix masculine 2 (France)","name":"Google français 3 (Natural)","altNames":["Android Speech Recognition and Synthesis from Google fr-fr-x-frb-network","Chrome OS français 3","Android Speech Recognition and Synthesis from Google fr-fr-x-frb-local"],"nativeID":["fr-fr-x-frb-network","fr-fr-x-frb-local"],"language":"fr-FR","gender":"male","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Voix féminine 1 (Canada)","name":"Android Speech Recognition and Synthesis from Google fr-ca-x-caa-network","altNames":["Android Speech Recognition and Synthesis from Google fr-ca-x-caa-local","Android Speech Recognition and Synthesis from Google fr-CA-language"],"nativeID":["fr-ca-x-caa-network","fr-ca-x-caa-local"],"language":"fr-CA","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Voix féminine 2 (Canada)","name":"Android Speech Recognition and Synthesis from Google fr-ca-x-cac-network","altNames":["Android Speech Recognition and Synthesis from Google fr-ca-x-cac-local"],"nativeID":["fr-ca-x-cac-network","fr-ca-x-cac-local"],"language":"fr-CA","gender":"female","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Voix masculine 1 (Canada)","name":"Android Speech Recognition and Synthesis from Google fr-ca-x-cab-network","altNames":["Android Speech Recognition and Synthesis from Google fr-ca-x-cab-local"],"nativeID":["fr-ca-x-cab-network","fr-ca-x-cab-local"],"language":"fr-CA","gender":"male","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}},{"label":"Voix masculine 2 (Canada)","name":"Android Speech Recognition and Synthesis from Google fr-ca-x-cad-network","altNames":["Android Speech Recognition and Synthesis from Google fr-ca-x-cad-local"],"nativeID":["fr-ca-x-cad-network","fr-ca-x-cad-local"],"language":"fr-CA","gender":"male","quality":["high"],"rate":1,"pitch":1,"os":["Android","ChromeOS"],"preloaded":true,"controls":{"boundary":false}}]`), n$q = {
  language: "fr",
  defaultRegion: e$u,
  testUtterance: a$u,
  voices: r$6
};

var frMfhjukJ4 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: n$q,
  defaultRegion: e$u,
  language: l$k,
  testUtterance: a$u,
  voices: r$6
});

const n$p = "gl", a$t = "gl-ES", e$t = "Ola, chámome {name} e son unha voz galega.", l$j = [{ label: "Sabela", name: "Microsoft Sabela Online (Natural) - Galician", language: "gl-ES", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Roi", name: "Microsoft Roi Online (Natural) - Galician", language: "gl-ES", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Carmela", name: "Carmela", localizedName: "apple", language: "gl-ES", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }], o$p = {
  language: "gl",
  defaultRegion: a$t,
  testUtterance: e$t,
  voices: l$j
};

var glDwtzWds9 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: o$p,
  defaultRegion: a$t,
  language: n$p,
  testUtterance: e$t,
  voices: l$j
});

const o$o = "he", e$s = "he-IL", a$s = "שלום, שמי {name} ואני קול עברי.", l$i = [{ label: "Hila", name: "Microsoft Hila Online (Natural) - Hebrew (Israel)", language: "he-IL", altLanguage: "iw-IL", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Avri", name: "Microsoft Avri Online (Natural) - Hebrew (Israel)", language: "he-IL", altLanguage: "iw-IL", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Carmit", name: "Carmit", localizedName: "apple", language: "he-IL", altLanguage: "iw-IL", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Asaf", name: "Microsoft Asaf - Hebrew (Israel)", language: "he-IL", altLanguage: "iw-IL", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "קול גברי 1", name: "Android Speech Recognition and Synthesis from Google he-il-x-heb-network", altNames: ["Android Speech Recognition and Synthesis from Google he-il-x-heb-local", "Android Speech Recognition and Synthesis from Google he-IL-language"], nativeID: ["he-il-x-heb-network", "he-il-x-heb-local"], language: "he-IL", altLanguage: "iw-IL", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "קול נשי 1", name: "Android Speech Recognition and Synthesis from Google he-il-x-hec-network", altNames: ["Android Speech Recognition and Synthesis from Google he-il-x-hec-local"], nativeID: ["he-il-x-hec-network", "he-il-x-hec-local"], language: "he-IL", altLanguage: "iw-IL", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "קול גברי 2", name: "Android Speech Recognition and Synthesis from Google he-il-x-hed-network", altNames: ["Android Speech Recognition and Synthesis from Google he-il-x-hed-local"], nativeID: ["he-il-x-hed-network", "he-il-x-hed-local"], language: "he-IL", altLanguage: "iw-IL", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "קול נשי 2", name: "Android Speech Recognition and Synthesis from Google he-il-x-hee-network", altNames: ["Android Speech Recognition and Synthesis from Google he-il-x-hee-local"], nativeID: ["he-il-x-hee-network", "he-il-x-hee-local"], language: "he-IL", altLanguage: "iw-IL", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], n$o = {
  language: "he",
  defaultRegion: e$s,
  testUtterance: a$s,
  voices: l$i
};

var heCfajFNE_ = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: n$o,
  defaultRegion: e$s,
  language: o$o,
  testUtterance: a$s,
  voices: l$i
});

const i$3 = "hi", e$r = "hi-IN", a$r = "नमस्कार, मेरा नाम {name} है और मैं एक हिंदी आवाज़ हूँ।", o$n = [{ label: "Swara", name: "Microsoft Swara Online (Natural) - Hindi (India)", language: "hi-IN", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Madhur", name: "Microsoft Madhur Online (Natural) - Hindi (India)", language: "hi-IN", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "महिला Google आवाज़", name: "Google हिन्दी", note: "This voice is pre-loaded in Chrome on desktop. Utterances that are longer than 14 seconds long can trigger a bug with this voice, check the notes in the project's README for more information.", language: "hi-IN", gender: "female", quality: ["high"], rate: 1, pitch: 1, controls: { boundary: false }, browser: ["ChromeDesktop"], preloaded: true }, { label: "Kiyara", name: "Kiyara", localizedName: "apple", language: "hi-IN", gender: "female", quality: ["low", "normal", "high"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Lekha", name: "Lekha", localizedName: "apple", language: "hi-IN", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Neel", name: "Neel", localizedName: "apple", language: "hi-IN", gender: "male", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Kalpana", name: "Microsoft Kalpana - Hindi (India)", language: "hi-IN", gender: "female", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Hemant", name: "Microsoft Hemant - Hindi (India)", language: "hi-IN", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "महिला आवाज़ 1", name: "Google हिन्दी 1 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google hi-in-x-hia-network", "Chrome OS हिन्दी 2", "Android Speech Recognition and Synthesis from Google hi-in-x-hia-local", "Android Speech Recognition and Synthesis from Google hi-IN-language"], nativeID: ["hi-in-x-hia-network", "hi-in-x-hia-local"], language: "hi-IN", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "महिला आवाज़ 2", name: "Google हिन्दी 2 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google hi-in-x-hic-network", "Chrome OS हिन्दी 3", "Android Speech Recognition and Synthesis from Google hi-in-x-hic-local"], nativeID: ["hi-in-x-hic-network", "hi-in-x-hic-local"], language: "hi-IN", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "महिला आवाज़ 3", name: "Chrome OS हिन्दी 1", language: "hi-IN", gender: "female", quality: ["normal"], rate: 1, pitch: 1, os: ["ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "पुरुष आवाज 1", name: "Google हिन्दी 3 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google hi-in-x-hid-network", "Chrome OS हिन्दी 4", "Android Speech Recognition and Synthesis from Google hi-in-x-hid-local"], nativeID: ["hi-in-x-hid-network", "hi-in-x-hid-local"], language: "hi-IN", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "पुरुष आवाज 2", name: "Google हिन्दी 4 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google hi-in-x-hie-network", "Chrome OS हिन्दी 5", "Android Speech Recognition and Synthesis from Google hi-in-x-hie-local"], nativeID: ["hi-in-x-hie-network", "hi-in-x-hie-local"], language: "hi-IN", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], n$n = {
  language: "hi",
  defaultRegion: e$r,
  testUtterance: a$r,
  voices: o$n
};

var hiPv2ttBoh = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: n$n,
  defaultRegion: e$r,
  language: i$3,
  testUtterance: a$r,
  voices: o$n
});

const o$m = "hr", a$q = "hr-HR", e$q = "Pozdrav, ja sam {name} i hrvatski sam glas.", r$5 = [{ label: "Gabrijela", name: "Microsoft Gabrijela Online (Natural) - Croatian (Croatia)", language: "hr-HR", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Srecko", name: "Microsoft Srecko Online (Natural) - Croatian (Croatia)", language: "hr-HR", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Lana", name: "Lana", localizedName: "apple", altNames: ["Lana (poboljšani)", "Lana (hrvatski (Hrvatska))"], language: "hr-HR", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Matej", name: "Microsoft Matej - Croatian (Croatia)", language: "hr-HR", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Ženski glas", name: "Android Speech Recognition and Synthesis from Google hr-hr-x-hra-network", altNames: ["Android Speech Recognition and Synthesis from Google hr-hr-x-hra-local"], nativeID: ["hr-hr-x-hra-network", "hr-hr-x-hra-local"], language: "hr-HR", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Muški glas", name: "Android Speech Recognition and Synthesis from Google hr-hr-x-hrb-network", altNames: ["Android Speech Recognition and Synthesis from Google hr-hr-x-hrb-local", "Android Speech Recognition and Synthesis from Google hr-HR-language"], nativeID: ["hr-hr-x-hrb-network", "hr-hr-x-hrb-local"], language: "hr-HR", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], n$m = {
  language: "hr",
  defaultRegion: a$q,
  testUtterance: e$q,
  voices: r$5
};

var hrMRApcEKR = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: n$m,
  defaultRegion: a$q,
  language: o$m,
  testUtterance: e$q,
  voices: r$5
});

const l$h = "hu", e$p = "hu-HU", a$p = "Helló, a nevem {name} és magyar hangú vagyok.", n$l = [{ label: "Noemi", name: "Microsoft Noemi Online (Natural) - Hungarian (Hungary)", language: "hu-HU", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Tamas", name: "Microsoft Tamas Online (Natural) - Hungarian (Hungary)", language: "hu-HU", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Tünde", name: "Tünde", localizedName: "apple", language: "hu-HU", gender: "female", quality: ["low", "normal", "high"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Szabolcs", name: "Microsoft Szabolcs - Hungarian (Hungary)", language: "hu-HU", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Női hang", name: "Google Magyar (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google hu-hu-x-kfl-network", "Chrome OS Magyar", "Android Speech Recognition and Synthesis from Google hu-hu-x-kfl-local", "Android Speech Recognition and Synthesis from Google hu-HU-language"], nativeID: ["hu-hu-x-kfl-network", "hu-hu-x-kfl-local"], language: "hu-HU", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], o$l = {
  language: "hu",
  defaultRegion: e$p,
  testUtterance: a$p,
  voices: n$l
};

var huDGRDZdHH = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: o$l,
  defaultRegion: e$p,
  language: l$h,
  testUtterance: a$p,
  voices: n$l
});

const i$2 = "id", e$o = "id-ID", a$o = "Halo, nama saya {name} dan saya suara Indonesia.", o$k = [{ label: "Gadis", name: "Microsoft Gadis Online (Natural) - Indonesian (Indonesia)", language: "id-ID", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Ardi", name: "Microsoft Ardi Online (Natural) - Indonesian (Indonesia)", language: "id-ID", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Suara Google wanita", name: "Google Bahasa Indonesia", note: "This voice is pre-loaded in Chrome on desktop. Utterances that are longer than 14 seconds long can trigger a bug with this voice, check the notes in the project's README for more information.", language: "id-ID", gender: "female", quality: ["high"], rate: 1, pitch: 1, controls: { boundary: false }, browser: ["ChromeDesktop"], preloaded: true }, { label: "Damayanti", name: "Damayanti", localizedName: "apple", language: "id-ID", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Andika", name: "Microsoft Andika - Indonesian (Indonesia)", language: "id-ID", gender: "female", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Suara wanita 1", name: "Google Bahasa Indonesia 1 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google id-id-x-idc-network", "Chrome OS Bahasa Indonesia 1", "Android Speech Recognition and Synthesis from Google id-id-x-idc-local", "Android Speech Recognition and Synthesis from Google id-ID-language"], nativeID: ["id-id-x-idc-network", "id-id-x-idc-local"], language: "id-ID", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Suara wanita 2", name: "Google Bahasa Indonesia 2 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google id-id-x-idd-network", "Chrome OS Bahasa Indonesia 2", "Android Speech Recognition and Synthesis from Google id-id-x-idd-local"], nativeID: ["id-id-x-idd-network", "id-id-x-idd-local"], language: "id-ID", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Suara laki-laki 1", name: "Google Bahasa Indonesia 3 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google id-id-x-ide-network", "Chrome OS Bahasa Indonesia 3", "Android Speech Recognition and Synthesis from Google id-id-x-ide-local"], nativeID: ["id-id-x-ide-network", "id-id-x-ide-local"], language: "id-ID", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Suara laki-laki 2", name: "Google Bahasa Indonesia 4 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google id-id-x-dfz-network", "Chrome OS Bahasa Indonesia 4", "Android Speech Recognition and Synthesis from Google id-id-x-dfz-local"], nativeID: ["id-id-x-dfz-network", "id-id-x-dfz-local"], language: "id-ID", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], n$k = {
  language: "id",
  defaultRegion: e$o,
  testUtterance: a$o,
  voices: o$k
};

var idDZUuUiTG = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: n$k,
  defaultRegion: e$o,
  language: i$2,
  testUtterance: a$o,
  voices: o$k
});

const l$g = "it", e$n = "it-IT", a$n = "Ciao, mi chiamo {name} e sono una voce italiana.", i$1 = [{ label: "Elsa (Alta qualita)", name: "Microsoft Elsa Online (Natural) - Italian (Italy)", language: "it-IT", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Isabella", name: "Microsoft Isabella Online (Natural) - Italian (Italy)", language: "it-IT", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Giuseppe", name: "Microsoft GiuseppeMultilingual Online (Natural) - Italian (Italy)", language: "it-IT", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Diego", name: "Microsoft Diego Online (Natural) - Italian (Italy)", language: "it-IT", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Voce Google femminile", name: "Google italiano", note: "This voice is pre-loaded in Chrome on desktop. Utterances that are longer than 14 seconds long can trigger a bug with this voice, check the notes in the project's README for more information.", language: "it-IT", gender: "female", quality: ["high"], rate: 1, pitch: 1, controls: { boundary: false }, browser: ["ChromeDesktop"], preloaded: true }, { label: "Federica", name: "Federica", localizedName: "apple", language: "it-IT", gender: "female", quality: ["low", "normal", "high"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Emma", name: "Emma", localizedName: "apple", language: "it-IT", gender: "female", quality: ["low", "normal", "high"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Alice", name: "Alice", localizedName: "apple", language: "it-IT", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Paola", name: "Paola", localizedName: "apple", language: "it-IT", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Luca", name: "Luca", localizedName: "apple", language: "it-IT", gender: "male", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Elsa", name: "Microsoft Elsa - Italian (Italy)", language: "it-IT", gender: "female", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Cosimo", name: "Microsoft Cosimo - Italian (Italy)", language: "it-IT", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Voce femminile 1", name: "Google italiano 2 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google it-it-x-itb-network", "Chrome OS italiano 2", "Android Speech Recognition and Synthesis from Google it-it-x-itb-local", "Android Speech Recognition and Synthesis from Google it-IT-language"], nativeID: ["it-it-x-itb-network", "it-it-x-itb-local"], language: "it-IT", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Voce femminile 2", name: "Google italiano 1 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google it-it-x-kda-network", "Chrome OS italiano 1", "Android Speech Recognition and Synthesis from Google it-it-x-kda-local"], nativeID: ["it-it-x-kda-network", "it-it-x-kda-local"], language: "it-IT", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Voce maschile 1", name: "Google italiano 3 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google it-it-x-itc-network", "Chrome OS italiano 3", "Android Speech Recognition and Synthesis from Google it-it-x-itc-local"], nativeID: ["it-it-x-itc-network", "it-it-x-itc-local"], language: "it-IT", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Voce maschile 2", name: "Google italiano 4 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google it-it-x-itd-network", "Chrome OS italiano 4", "Android Speech Recognition and Synthesis from Google it-it-x-itd-local"], nativeID: ["it-it-x-itd-network", "it-it-x-itd-local"], language: "it-IT", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], t$6 = {
  language: "it",
  defaultRegion: e$n,
  testUtterance: a$n,
  voices: i$1
};

var itDJUYnjyj = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: t$6,
  defaultRegion: e$n,
  language: l$g,
  testUtterance: a$n,
  voices: i$1
});

const l$f = "ja", e$m = "ja-JP", a$m = "こんにちは。私の名前は{name}で、日本語の声を担当しています。", o$j = [{ label: "Nanami", name: "Microsoft Nanami Online (Natural) - Japanese (Japan)", language: "ja-JP", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Keita", name: "Microsoft Keita Online (Natural) - Japanese (Japan)", language: "ja-JP", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Hattori", name: "Hattori", nativeID: ["com.apple.ttsbundle.siri_Hattori_ja-JP_premium"], localizedName: "apple", language: "ja-JP", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Google の女性の声", name: "Google 日本語", note: "This voice is pre-loaded in Chrome on desktop. Utterances that are longer than 14 seconds long can trigger a bug with this voice, check the notes in the project's README for more information.", language: "ja-JP", gender: "female", quality: ["high"], rate: 1, pitch: 1, controls: { boundary: false }, browser: ["ChromeDesktop"], preloaded: true }, { label: "O-Ren", name: "O-Ren", localizedName: "apple", language: "ja-JP", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Kyoko", name: "Kyoko", localizedName: "apple", language: "ja-JP", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Otoya", name: "Otoya", localizedName: "apple", language: "ja-JP", gender: "male", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Ayumi", name: "Microsoft Ayumi - Japanese (Japan)", language: "ja-JP", gender: "female", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Haruka", name: "Microsoft Haruka - Japanese (Japan)", language: "ja-JP", gender: "female", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Ichiro", name: "Microsoft Ichiro - Japanese (Japan)", language: "ja-JP", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "女性の声1", name: "Google 日本語 1 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google ja-jp-x-htm-network", "Chrome OS 日本語 1", "Android Speech Recognition and Synthesis from Google ja-jp-x-htm-local", "Android Speech Recognition and Synthesis from Google ja-JP-language"], nativeID: ["ja-jp-x-htm-network", "ja-jp-x-htm-local"], language: "ja-JP", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "女性の声2", name: "Chrome OS 日本語 2", altNames: ["Android Speech Recognition and Synthesis from Google ja-jp-x-jab-network", "Android Speech Recognition and Synthesis from Google ja-jp-x-jab-local"], nativeID: ["ja-jp-x-jab-network", "ja-jp-x-jab-local"], language: "ja-JP", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "男性の声1", name: "Google 日本語 2 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google ja-jp-x-jac-network", "Chrome OS 日本語 3", "Android Speech Recognition and Synthesis from Google ja-jp-x-jac-local"], nativeID: ["ja-jp-x-jac-network", "ja-jp-x-jac-local"], language: "ja-JP", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "男性の声2", name: "Google 日本語 3 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google ja-jp-x-jad-network", "Chrome OS 日本語 4", "Android Speech Recognition and Synthesis from Google ja-jp-x-jad-local"], nativeID: ["ja-jp-x-jad-network", "ja-jp-x-jad-local"], language: "ja-JP", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], n$j = {
  language: "ja",
  defaultRegion: e$m,
  testUtterance: a$m,
  voices: o$j
};

var jaBpFcZRMu = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: n$j,
  defaultRegion: e$m,
  language: l$f,
  testUtterance: a$m,
  voices: o$j
});

const t$5 = "kk", a$l = "kk-KZ", e$l = "Сәлеметсіз бе, менің атым {name} және мен қазақ дауыстымын.", l$e = [{ label: "Aigul", name: "Microsoft Aigul Online (Natural) - Kazakh (Kazakhstan)", language: "kk-KZ", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Daulet", name: "Microsoft Daulet Online (Natural) - Kazakh (Kazakhstan)", language: "kk-KZ", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Aru", name: "Aru", nativeID: ["com.apple.voice.Aru"], localizedName: "apple", language: "kk-KZ", gender: "female", quality: ["normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }], n$i = {
  language: "kk",
  defaultRegion: a$l,
  testUtterance: e$l,
  voices: l$e
};

var kkC480t1iH = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: n$i,
  defaultRegion: a$l,
  language: t$5,
  testUtterance: e$l,
  voices: l$e
});

const o$i = "kn", e$k = "kn-IN", n$h = "ಹಲೋ, ನನ್ನ ಹೆಸರು {name} ಮತ್ತು ನಾನು ಕನ್ನಡ ಧ್ವನಿ.", a$k = [{ label: "Sapna", name: "Microsoft Sapna Online (Natural) - Kannada (India)", language: "kn-IN", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Gagan", name: "Microsoft Gagan Online (Natural) - Kannada (India)", language: "kn-IN", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Soumya", name: "Soumya", localizedName: "apple", language: "kn-IN", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "ಸ್ತ್ರೀ ಧ್ವನಿ", name: "Android Speech Recognition and Synthesis from Google kn-in-x-knf-network", altNames: ["Android Speech Recognition and Synthesis from Google kn-in-x-knf-local", "Android Speech Recognition and Synthesis from Google kn-IN-language"], nativeID: ["kn-in-x-knf-network", "kn-in-x-knf-local"], language: "kn-IN", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "ಪುರುಷ ಧ್ವನಿ", name: "Android Speech Recognition and Synthesis from Google kn-in-x-knm-network", altNames: ["Android Speech Recognition and Synthesis from Google kn-in-x-knm-local"], nativeID: ["kn-in-x-knm-network", "kn-in-x-knm-local"], language: "kn-IN", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], l$d = {
  language: "kn",
  defaultRegion: e$k,
  testUtterance: n$h,
  voices: a$k
};

var knBVqs26qv = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: l$d,
  defaultRegion: e$k,
  language: o$i,
  testUtterance: n$h,
  voices: a$k
});

const l$c = "ko", e$j = "ko-KR", o$h = "안녕하세요, 저는 {name}이고 한국어 음성입니다.", a$j = [{ label: "SunHi", name: "Microsoft SunHi Online (Natural) - Korean (Korea)", language: "ko-KR", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Hyunsu", name: "Microsoft HyunsuMultilingual Online (Natural) - Korean (Korea)", altNames: ["Microsoft Hyunsu Online (Natural) - Korean (Korea)"], language: "ko-KR", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "InJoon", name: "Microsoft InJoon Online (Natural) - Korean (Korea)", language: "ko-KR", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Google 여성 음성", name: "Google 한국의", note: "This voice is pre-loaded in Chrome on desktop. Utterances that are longer than 14 seconds long can trigger a bug with this voice, check the notes in the project's README for more information.", language: "ko-KR", gender: "female", quality: ["high"], rate: 1, pitch: 1, controls: { boundary: false }, browser: ["ChromeDesktop"], preloaded: true }, { label: "Yuna", name: "Yuna", localizedName: "apple", language: "ko-KR", gender: "female", quality: ["low", "normal", "high"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Jian", name: "Jian", localizedName: "apple", language: "ko-KR", gender: "female", quality: ["low", "normal", "high"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Suhyun", name: "Suhyun", localizedName: "apple", language: "ko-KR", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Sora", name: "Sora", localizedName: "apple", language: "ko-KR", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Minsu", name: "Minsu", localizedName: "apple", language: "ko-KR", gender: "male", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Heami", name: "Microsoft Heami - Korean (Korea)", language: "ko-KR", gender: "female", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "여성 목소리 1", name: "Google 한국어 2 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google ko-kr-x-kob-network", "Chrome OS 한국어 2", "Android Speech Recognition and Synthesis from Google ko-kr-x-kob-local", "Android Speech Recognition and Synthesis from Google ko-KR-language"], nativeID: ["ko-kr-x-kob-network", "ko-kr-x-kob-local"], language: "ko-KR", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "여성 목소리 2", name: "Google 한국어 1 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google ko-kr-x-ism-network", "Chrome OS 한국어 1", "Android Speech Recognition and Synthesis from Google ko-kr-x-ism-local"], nativeID: ["ko-kr-x-ism-network", "ko-kr-x-ism-local"], language: "ko-KR", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "남성 1", name: "Google 한국어 3 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google ko-kr-x-koc-network", "Chrome OS 한국어 3", "Android Speech Recognition and Synthesis from Google ko-kr-x-koc-local"], nativeID: ["ko-kr-x-koc-network", "ko-kr-x-koc-local"], language: "ko-KR", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "남성 2", name: "Google 한국어 4 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google ko-kr-x-kod-network", "Chrome OS 한국어 4", "Android Speech Recognition and Synthesis from Google ko-kr-x-kod-local"], nativeID: ["ko-kr-x-kod-network", "ko-kr-x-kod-local"], language: "ko-KR", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], n$g = {
  language: "ko",
  defaultRegion: e$j,
  testUtterance: o$h,
  voices: a$j
};

var koTNoPZd6N = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: n$g,
  defaultRegion: e$j,
  language: l$c,
  testUtterance: o$h,
  voices: a$j
});

const n$f = "mr", e$i = "mr-IN", a$i = "नमस्कार, माझे नाव {name} आहे आणि मी एक मराठी आवाज आहे.", r$4 = [{ label: "Aarohi", name: "Microsoft Aarohi Online (Natural) - Marathi (India)", language: "mr-IN", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Manohar", name: "Microsoft Manohar Online (Natural) - Marathi (India)", language: "mr-IN", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Ananya", name: "Ananya", localizedName: "apple", language: "mr-IN", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "स्त्री आवाज", name: "Android Speech Recognition and Synthesis from Google mr-in-x-mrf-network", altNames: ["Android Speech Recognition and Synthesis from Google mr-in-x-mrf-local", "Android Speech Recognition and Synthesis from Google mr-IN-language"], nativeID: ["mr-in-x-mrf-network", "mr-in-x-mrf-local"], language: "mr-IN", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["ChromeOS"], preloaded: true, controls: { boundary: false } }], o$g = {
  language: "mr",
  defaultRegion: e$i,
  testUtterance: a$i,
  voices: r$4
};

var mrDstAHTvT = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: o$g,
  defaultRegion: e$i,
  language: n$f,
  testUtterance: a$i,
  voices: r$4
});

const n$e = "ms", e$h = "ms-MY", a$h = "Hello, nama saya {name} dan saya suara Melayu.", o$f = [{ label: "Yasmin", name: "Microsoft Yasmin Online (Natural) - Malay (Malaysia)", language: "ms-MY", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Osman", name: "Microsoft Osman Online (Natural) - Malay (Malaysia)", language: "ms-MY", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Amira", name: "Amira", localizedName: "apple", language: "ms-MY", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Rizwan", name: "Microsoft Rizwan - Malay (Malaysia)", language: "ms-MY", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Suara perempuan 1", name: "Android Speech Recognition and Synthesis from Google ms-my-x-msc-network", altNames: ["Android Speech Recognition and Synthesis from Google ms-my-x-msc-local", "Android Speech Recognition and Synthesis from Google ms-MY-language"], nativeID: ["ms-my-x-msc-network", "ms-my-x-msc-local"], language: "ms-MY", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Suara perempuan 2", name: "Android Speech Recognition and Synthesis from Google ms-my-x-mse-network", altNames: ["Android Speech Recognition and Synthesis from Google ms-my-x-mse-local"], nativeID: ["ms-my-x-mse-network", "ms-my-x-mse-local"], language: "ms-MY", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Suara lelaki 1", name: "Android Speech Recognition and Synthesis from Google ms-my-x-msd-network", altNames: ["Android Speech Recognition and Synthesis from Google ms-my-x-msd-local"], nativeID: ["ms-my-x-msd-network", "ms-my-x-msd-local"], language: "ms-MY", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Suara lelaki 2", name: "Android Speech Recognition and Synthesis from Google ms-my-x-msg-network", altNames: ["Android Speech Recognition and Synthesis from Google ms-my-x-msg-local"], nativeID: ["ms-my-x-msg-network", "ms-my-x-msg-local"], language: "ms-MY", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], l$b = {
  language: "ms",
  defaultRegion: e$h,
  testUtterance: a$h,
  voices: o$f
};

var msBceBSDJ = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: l$b,
  defaultRegion: e$h,
  language: n$e,
  testUtterance: a$h,
  voices: o$f
});

const a$g = "nb", e$g = "nb-NO", o$e = "Hei, jeg heter {name} og er en norsk stemme.", n$d = [{ label: "Pernille", name: "Microsoft Pernille Online (Natural) - Norwegian (Bokmål, Norway)", language: "nb-NO", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Finn", name: "Microsoft Finn Online (Natural) - Norwegian (Bokmål Norway)", language: "nb-NO", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Nora", name: "Nora", localizedName: "apple", language: "nb-NO", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Henrik", name: "Henrik", localizedName: "apple", language: "nb-NO", gender: "male", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Jon", name: "Microsoft Jon - Norwegian (Bokmål Norway)", language: "nb-NO", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Kvinnestemme 1", name: "Google Norsk Bokmål 2 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google nb-no-x-cfl-network", "Chrome OS Norsk Bokmål 2", "Android Speech Recognition and Synthesis from Google nb-no-x-cfl-local", "Android Speech Recognition and Synthesis from Google nb-NO-language"], nativeID: ["nb-no-x-cfl-network", "nb-no-x-cfl-local"], language: "nb-NO", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Kvinnestemme 2", name: "Google Norsk Bokmål 1 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google nb-no-x-rfj-network", "Chrome OS Norsk Bokmål 1", "Android Speech Recognition and Synthesis from Google nb-no-x-rfj-local"], nativeID: ["nb-no-x-rfj-network", "nb-no-x-rfj-local"], language: "nb-NO", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Kvinnestemme 3", name: "Google Norsk Bokmål 4 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google nb-no-x-tfs-network", "Chrome OS Norsk Bokmål 4", "Android Speech Recognition and Synthesis from Google nb-no-x-tfs-local"], nativeID: ["nb-no-x-tfs-network", "nb-no-x-tfs-local"], language: "nb-NO", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Mannsstemme 1", name: "Google Norsk Bokmål 3 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google nb-no-x-cmj-network", "Chrome OS Norsk Bokmål 3", "Android Speech Recognition and Synthesis from Google nb-no-x-cmj-local"], nativeID: ["nb-no-x-cmj-network", "nb-no-x-cmj-local"], language: "nb-NO", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Mannsstemme 2", name: "Google Norsk Bokmål 5 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google nb-no-x-tmg-network", "Chrome OS Norsk Bokmål 5", "Android Speech Recognition and Synthesis from Google nb-no-x-tmg-local"], nativeID: ["nb-no-x-tmg-network", "nb-no-x-tmg-local"], language: "nb-NO", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], l$a = {
  language: "nb",
  defaultRegion: e$g,
  testUtterance: o$e,
  voices: n$d
};

var nbCwPbwGI = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: l$a,
  defaultRegion: e$g,
  language: a$g,
  testUtterance: o$e,
  voices: n$d
});

const a$f = "nl", e$f = "nl-NL", l$9 = "Hallo, mijn naam is {name} en ik ben een Nederlandse stem.", n$c = [{ label: "Colette", name: "Microsoft Colette Online (Natural) - Dutch (Netherlands)", language: "nl-NL", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Fenna", name: "Microsoft Fenna Online (Natural) - Dutch (Netherlands)", language: "nl-NL", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Hanna", name: "Microsoft Hanna Online - Dutch (Netherlands)", language: "nl-NL", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Maarten", name: "Microsoft Maarten Online (Natural) - Dutch (Netherlands)", language: "nl-NL", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Dena", name: "Microsoft Dena Online (Natural) - Dutch (Belgium)", language: "nl-BE", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Arnaud", name: "Microsoft Arnaud Online (Natural) - Dutch (Belgium)", language: "nl-BE", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Google mannelijke stem", name: "Google Nederlands", note: "This voice is pre-loaded in Chrome on desktop. Utterances that are longer than 14 seconds long can trigger a bug with this voice, check the notes in the project's README for more information.", language: "nl-NL", gender: "male", quality: ["high"], rate: 1, pitch: 1, controls: { boundary: false }, browser: ["ChromeDesktop"], preloaded: true }, { label: "Claire", name: "Claire", localizedName: "apple", language: "nl-NL", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Xander", name: "Xander", localizedName: "apple", language: "nl-NL", gender: "male", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Ellen", name: "Ellen", localizedName: "apple", language: "nl-BE", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Frank", name: "Microsoft Frank - Dutch (Netherlands)", language: "nl-NL", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Vrouwelijke stem 1 (Nederland)", name: "Google Nederlands 4 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google nl-nl-x-lfc-network", "Chrome OS Nederlands 4", "Android Speech Recognition and Synthesis from Google nl-nl-x-lfc-local", "Android Speech Recognition and Synthesis from Google nl-NL-language"], nativeID: ["nl-nl-x-lfc-network", "nl-nl-x-lfc-local"], language: "nl-NL", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Vrouwelijke stem 2 (Nederland)", name: "Google Nederlands 1 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google nl-nl-x-tfb-network", "Chrome OS Nederlands 1", "Android Speech Recognition and Synthesis from Google nl-nl-x-tfb-local"], nativeID: ["nl-nl-x-tfb-network", "nl-nl-x-tfb-local"], language: "nl-NL", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Vrouwelijke stem 3 (Nederland)", name: "Google Nederlands 5 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google nl-nl-x-yfr-network", "Chrome OS Nederlands 5", "Android Speech Recognition and Synthesis from Google nl-nl-x-yfr-local"], nativeID: ["nl-nl-x-yfr-network", "nl-nl-x-yfr-local"], language: "nl-NL", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Mannelijke stem 1 (Nederland)", name: "Google Nederlands 2 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google nl-nl-x-bmh-network", "Chrome OS Nederlands 2", "Android Speech Recognition and Synthesis from Google nl-nl-x-bmh-local"], nativeID: ["nl-nl-x-bmh-network", "nl-nl-x-bmh-local"], language: "nl-NL", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Mannelijke stem 2 (Nederland)", name: "Google Nederlands 3 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google nl-nl-x-dma-network", "Chrome OS Nederlands 3", "Android Speech Recognition and Synthesis from Google nl-nl-x-dma-local"], nativeID: ["nl-nl-x-dma-network", "nl-nl-x-dma-local"], language: "nl-NL", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Vrouwelijke stem (België)", name: "Android Speech Recognition and Synthesis from Google nl-be-x-bec-network", altNames: ["Android Speech Recognition and Synthesis from Google nl-be-x-bec-local", "Android Speech Recognition and Synthesis from Google nl-BE-language"], nativeID: ["nl-be-x-bec-network", "nl-be-x-bec-local"], language: "nl-BE", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Mannelijke stem (België)", name: "Android Speech Recognition and Synthesis from Google nl-be-x-bed-network", altNames: ["Android Speech Recognition and Synthesis from Google nl-be-x-bed-local"], nativeID: ["nl-be-x-bed-network", "nl-be-x-bed-local"], language: "nl-BE", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], o$d = {
  language: "nl",
  defaultRegion: e$f,
  testUtterance: l$9,
  voices: n$c
};

var nlBmWDmw5 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: o$d,
  defaultRegion: e$f,
  language: a$f,
  testUtterance: l$9,
  voices: n$c
});

const a$e = "pl", e$e = "pl-PL", l$8 = "Cześć, nazywam się {name} i mam polski głos.", o$c = [{ label: "Zofia", name: "Microsoft Zofia Online (Natural) - Polish (Poland)", language: "pl-PL", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Paulina", name: "Microsoft Paulina Online - Polish (Poland)", language: "pl-PL", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Marek", name: "Microsoft Marek Online (Natural) - Polish (Poland)", language: "pl-PL", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Żeński głos Google’a", name: "Google polski", note: "This voice is pre-loaded in Chrome on desktop. Utterances that are longer than 14 seconds long can trigger a bug with this voice, check the notes in the project's README for more information.", language: "pl-PL", gender: "female", quality: ["high"], rate: 1, pitch: 1, controls: { boundary: false }, browser: ["ChromeDesktop"], preloaded: true }, { label: "Ewa", name: "Ewa", localizedName: "apple", language: "pl-PL", gender: "female", quality: ["low", "normal", "high"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Zosia", name: "Zosia", localizedName: "apple", language: "pl-PL", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Krzysztof", name: "Krzysztof", localizedName: "apple", language: "pl-PL", gender: "male", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Paulina", name: "Microsoft Paulina - Polish (Poland)", language: "pl-PL", gender: "female", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Adam", name: "Microsoft Adam - Polish (Poland)", language: "pl-PL", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Głos żeński 1", name: "Google Polski 2 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google pl-pl-x-afb-network", "Chrome OS Polski 2", "Android Speech Recognition and Synthesis from Google pl-pl-x-afb-local", "Android Speech Recognition and Synthesis from Google pl-PL-language"], nativeID: ["pl-pl-x-afb-network", "pl-pl-x-afb-local"], language: "pl-PL", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Głos żeński 2", name: "Google Polski 1 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google pl-pl-x-oda-network", "Chrome OS Polski 1", "Android Speech Recognition and Synthesis from Google pl-pl-x-oda-local"], nativeID: ["pl-pl-x-oda-network", "pl-pl-x-oda-local"], language: "pl-PL", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Głos żeński 3", name: "Google Polski 5 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google pl-pl-x-zfg-network", "Chrome OS Polski 5", "Android Speech Recognition and Synthesis from Google pl-pl-x-zfg-local"], nativeID: ["pl-pl-x-zfg-network", "pl-pl-x-zfg-local"], language: "pl-PL", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Głos męski 1", name: "Google Polski 3 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google pl-pl-x-bmg-network", "Chrome OS Polski 3", "Android Speech Recognition and Synthesis from Google pl-pl-x-bmg-local"], nativeID: ["pl-pl-x-bmg-network", "pl-pl-x-bmg-local"], language: "pl-PL", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Głos męski 2", name: "Google Polski 4 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google pl-pl-x-jmk-network", "Chrome OS Polski 4", "Android Speech Recognition and Synthesis from Google pl-pl-x-jmk-local"], nativeID: ["pl-pl-x-jmk-network", "pl-pl-x-jmk-local"], language: "pl-PL", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], n$b = {
  language: "pl",
  defaultRegion: e$e,
  testUtterance: l$8,
  voices: o$c
};

var plCH8qoDu8 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: n$b,
  defaultRegion: e$e,
  language: a$e,
  testUtterance: l$8,
  voices: o$c
});

const t$4 = "pt", e$d = "pt-BR", a$d = "Olá, o meu nome é {name} e sou uma voz portuguesa.", o$b = [{ label: "Raquel", name: "Microsoft Raquel Online (Natural) - Portuguese (Portugal)", language: "pt-PT", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Duarte", name: "Microsoft Duarte Online (Natural) - Portuguese (Portugal)", language: "pt-PT", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Francisca", name: "Microsoft Francisca Online (Natural) - Portuguese (Brazil)", language: "pt-BR", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Thalita", name: "Microsoft ThalitaMultilingual Online (Natural) - Portuguese (Brazil)", language: "pt-BR", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Antonio", name: "Microsoft Antonio Online (Natural) - Portuguese (Brazil)", language: "pt-BR", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Voz feminina do Google", name: "Google português do Brasil", note: "This voice is pre-loaded in Chrome on desktop. Utterances that are longer than 14 seconds long can trigger a bug with this voice, check the notes in the project's README for more information.", language: "pt-BR", gender: "female", quality: ["high"], rate: 1, pitch: 1, controls: { boundary: false }, browser: ["ChromeDesktop"], preloaded: true }, { label: "Catarina", name: "Catarina", localizedName: "apple", language: "pt-PT", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Joana", name: "Joana", localizedName: "apple", language: "pt-PT", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Joaquim", name: "Joaquim", localizedName: "apple", language: "pt-PT", gender: "male", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Fernanda", name: "Fernanda", localizedName: "apple", language: "pt-BR", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Luciana", name: "Luciana", localizedName: "apple", language: "pt-BR", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Felipe", name: "Felipe", localizedName: "apple", language: "pt-BR", gender: "male", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Helia", name: "Microsoft Helia - Portuguese (Portugal)", language: "pt-PT", gender: "female", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Maria", name: "Microsoft Maria - Portuguese (Brazil)", language: "pt-BR", gender: "female", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Daniel", name: "Microsoft Daniel - Portuguese (Brazil)", language: "pt-BR", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Voz feminina 1 (Portugal)", name: "Google português de Portugal 1 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google pt-pt-x-jfb-network", "Android Speech Recognition and Synthesis from Google pt-pt-x-jfb-local", "Android Speech Recognition and Synthesis from Google pt-PT-language"], nativeID: ["pt-pt-x-jfb-network", "pt-pt-x-jfb-local"], language: "pt-PT", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Voz feminina 2 (Portugal)", name: "Google português de Portugal 4 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google pt-pt-x-sfs-network", "Chrome OS português de Portugal", "Android Speech Recognition and Synthesis from Google pt-pt-x-sfs-local"], nativeID: ["pt-pt-x-sfs-network", "pt-pt-x-sfs-local"], language: "pt-PT", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Voz masculina 1 (Portugal)", name: "Google português de Portugal 2 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google pt-pt-x-jmn-network", "Android Speech Recognition and Synthesis from Google pt-pt-x-jmn-local"], nativeID: ["pt-pt-x-jmn-network", "pt-pt-x-jmn-local"], language: "pt-PT", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Voz masculina 2 (Portugal)", name: "Google português de Portugal 3 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google pt-pt-x-pmj-network", "Android Speech Recognition and Synthesis from Google pt-pt-x-pmj-local"], nativeID: ["pt-pt-x-pmj-network", "pt-pt-x-pmj-local"], language: "pt-PT", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Voz feminina 1 (Brasil)", name: "Google português do Brasil 1 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google pt-br-x-afs-network", "Chrome OS português do Brasil", "Android Speech Recognition and Synthesis from Google pt-br-x-afs-local", "Android Speech Recognition and Synthesis from Google pt-BR-language"], nativeID: ["pt-br-x-afs-network", "pt-br-x-afs-local"], language: "pt-BR", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Voz feminina 2 (Brasil)", name: "Google português do Brasil 3 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google pt-br-x-pte-network", "Android Speech Recognition and Synthesis from Google pt-br-x-pte-local"], nativeID: ["pt-br-x-pte-network", "pt-br-x-pte-local"], language: "pt-BR", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Voz masculina  (Brasil)", name: "Google português do Brasil 2 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google pt-br-x-ptd-network", "Android Speech Recognition and Synthesis from Google pt-br-x-ptd-local"], nativeID: ["pt-br-x-ptd-network", "pt-br-x-ptd-local"], language: "pt-BR", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], l$7 = {
  language: "pt",
  defaultRegion: e$d,
  testUtterance: a$d,
  voices: o$b
};

var ptCjCENn24 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: l$7,
  defaultRegion: e$d,
  language: t$4,
  testUtterance: a$d,
  voices: o$b
});

const n$a = "ro", e$c = "ro-RO", a$c = "Buna ziua, ma numesc {name} si sunt o voce romaneasca.", o$a = [{ label: "Alina", name: "Microsoft Alina Online (Natural) - Romanian (Romania)", language: "ro-RO", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Emil", name: "Microsoft Emil Online (Natural) - Romanian (Romania)", language: "ro-RO", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Ioana", name: "Ioana", localizedName: "apple", language: "ro-RO", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Andrei", name: "Microsoft Andrei - Romanian (Romania)", language: "ro-RO", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Voce feminină", name: "Android Speech Recognition and Synthesis from Google ro-ro-x-vfv-network", altNames: ["Android Speech Recognition and Synthesis from Google ro-ro-x-vfv-local", "Android Speech Recognition and Synthesis from Google ro-RO-language"], nativeID: ["ro-ro-x-vfv-network", "ro-ro-x-vfv-local"], language: "ro-RO", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], r$3 = {
  language: "ro",
  defaultRegion: e$c,
  testUtterance: a$c,
  voices: o$a
};

var roBlJN7qkA = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: r$3,
  defaultRegion: e$c,
  language: n$a,
  testUtterance: a$c,
  voices: o$a
});

const o$9 = "ru", e$b = "ru-RU", a$b = "Здравствуйте, меня зовут {name} и я русский голос.", r$2 = [{ label: "Svetlana", name: "Microsoft Svetlana Online (Natural) - Russian (Russia)", language: "ru-RU", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Ekaterina", name: "Microsoft Ekaterina Online - Russian (Russia)", language: "ru-RU", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Dmitry", name: "Microsoft Dmitry Online (Natural) - Russian (Russia)", language: "ru-RU", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Google женский голос", name: "Google русский", note: "This voice is pre-loaded in Chrome on desktop. Utterances that are longer than 14 seconds long can trigger a bug with this voice, check the notes in the project's README for more information.", language: "ru-RU", gender: "female", quality: ["high"], rate: 1, pitch: 1, controls: { boundary: false }, browser: ["ChromeDesktop"], preloaded: true }, { label: "Katya", name: "Katya", localizedName: "apple", language: "ru-RU", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Milena", name: "Milena", localizedName: "apple", language: "ru-RU", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Yuri", name: "Yuri", localizedName: "apple", language: "ru-RU", gender: "male", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Irina", name: "Microsoft Irina - Russian (Russian)", language: "ru-RU", gender: "female", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Pavel", name: "Microsoft Pavel - Russian (Russian)", language: "ru-RU", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Женский голос 1", name: "Android Speech Recognition and Synthesis from Google ru-ru-x-dfc-network", altNames: ["Android Speech Recognition and Synthesis from Google ru-ru-x-dfc-local"], nativeID: ["ru-ru-x-dfc-network", "ru-ru-x-dfc-local"], language: "ru-RU", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Женский голос 2", name: "Android Speech Recognition and Synthesis from Google ru-ru-x-ruc-network", altNames: ["Android Speech Recognition and Synthesis from Google ru-ru-x-ruc-local"], nativeID: ["ru-ru-x-ruc-network", "ru-ru-x-ruc-local"], language: "ru-RU", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Женский голос 3", name: "Android Speech Recognition and Synthesis from Google ru-ru-x-rue-network", altNames: ["Android Speech Recognition and Synthesis from Google ru-ru-x-rue-local"], nativeID: ["ru-ru-x-rue-network", "ru-ru-x-rue-local"], language: "ru-RU", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Мужской голос 1", name: "Android Speech Recognition and Synthesis from Google ru-ru-x-rud-network", altNames: ["Android Speech Recognition and Synthesis from Google ru-ru-x-rud-local"], nativeID: ["ru-ru-x-rud-network", "ru-ru-x-rud-local"], language: "ru-RU", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Мужской голос 2", name: "Android Speech Recognition and Synthesis from Google ru-ru-x-ruf-network", altNames: ["Android Speech Recognition and Synthesis from Google ru-ru-x-ruf-local"], nativeID: ["ru-ru-x-ruf-network", "ru-ru-x-ruf-local"], language: "ru-RU", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], n$9 = {
  language: "ru",
  defaultRegion: e$b,
  testUtterance: a$b,
  voices: r$2
};

var ruUdzq1D5e = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: n$9,
  defaultRegion: e$b,
  language: o$9,
  testUtterance: a$b,
  voices: r$2
});

const l$6 = "sk", e$a = "sk-SK", a$a = "Dobrý deň, volám sa {name} a som slovenský hlas.", o$8 = [{ label: "Viktoria", name: "Microsoft Viktoria Online (Natural) - Slovak (Slovakia)", language: "sk-SK", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Lukas", name: "Microsoft Lukas Online (Natural) - Slovak (Slovakia)", language: "sk-SK", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Laura", name: "Laura", localizedName: "apple", language: "sk-SK", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Filip", name: "Microsoft Filip - Slovak (Slovakia)", language: "sk-SK", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Ženský hlas", name: "Google Slovenčina (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google sk-sk-x-sfk-network", "Android Speech Recognition and Synthesis from Google sk-sk-x-sfk-local", "Chrome OS Slovenčina", "Android Speech Recognition and Synthesis from Google sk-SK-language"], nativeID: ["sk-sk-x-sfk-network", "sk-sk-x-sfk-local"], language: "sk-SK", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], n$8 = {
  language: "sk",
  defaultRegion: e$a,
  testUtterance: a$a,
  voices: o$8
};

var skVAEHsTWJ = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: n$8,
  defaultRegion: e$a,
  language: l$6,
  testUtterance: a$a,
  voices: o$8
});

const o$7 = "sl", e$9 = "sl-SI", a$9 = "Pozdravljeni, moje ime je {name} in sem slovenski glas.", l$5 = [{ label: "Petra", name: "Microsoft Petra Online (Natural) - Slovenian (Slovenia)", language: "sl-SI", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Rok", name: "Microsoft Rok Online (Natural) - Slovenian (Slovenia)", language: "sl-SI", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Tina", name: "Tina", localizedName: "apple", language: "sl-SI", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Lado", name: "Microsoft Lado - Slovenian (Slovenia)", language: "sl-SI", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Ženski glas", name: "Android Speech Recognition and Synthesis from Google sl-si-x-frm-local", altNames: ["Android Speech Recognition and Synthesis from Google sl-SI-language"], nativeID: ["sl-si-x-frm-local"], language: "sl-SI", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], n$7 = {
  language: "sl",
  defaultRegion: e$9,
  testUtterance: a$9,
  voices: l$5
};

var slDaZQ1gp0 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: n$7,
  defaultRegion: e$9,
  language: o$7,
  testUtterance: a$9,
  voices: l$5
});

const n$6 = "sv", e$8 = "sv-SE", a$8 = "Hej, jag heter {name} och jag är en svensk röst.", o$6 = [{ label: "Sofie", name: "Microsoft Sofie Online (Natural) - Swedish (Sweden)", language: "sv-SE", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Mattias", name: "Microsoft Mattias Online (Natural) - Swedish (Sweden)", language: "sv-SE", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Klara", name: "Klara", localizedName: "apple", language: "sv-SE", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Alva", name: "Alva", localizedName: "apple", language: "sv-SE", gender: "female", quality: ["low", "normal", "high"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Oskar", name: "Oskar", note: "This voice can be installed on all Apple devices and offers two variants. Like all voices that can be installed on Apple devices, it suffers from inconsistent naming due to localization.", language: "sv-SE", gender: "male", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Bengt", name: "Microsoft Bengt - Swedish (Sweden)", language: "sv-SE", gender: "female", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Kvinnlig röst 1", name: "Google Svenska 1 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google sv-se-x-lfs-network", "Chrome OS Svenska", "Android Speech Recognition and Synthesis from Google sv-se-x-lfs-local", "Android Speech Recognition and Synthesis from Google sv-SE-language"], nativeID: ["sv-se-x-lfs-network", "sv-se-x-lfs-local"], language: "sv-SE", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Kvinnlig röst 2", name: "Google Svenska 2 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google sv-se-x-afp-network", "Android Speech Recognition and Synthesis from Google sv-se-x-afp-local"], nativeID: ["sv-se-x-afp-network", "sv-se-x-afp-local"], language: "sv-SE", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Kvinnlig röst 3", name: "Google Svenska 3 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google sv-se-x-cfg-network", "Android Speech Recognition and Synthesis from Google sv-se-x-cfg-local"], nativeID: ["sv-se-x-cfg-network", "sv-se-x-cfg-local"], language: "sv-SE", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Mansröst 1", name: "Google Svenska 4 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google sv-se-x-cmh-network", "Android Speech Recognition and Synthesis from Google sv-se-x-cmh-local"], nativeID: ["sv-se-x-cmh-network", "sv-se-x-cmh-local"], language: "sv-SE", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Mansröst 2", name: "Google Svenska 5 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google sv-se-x-dmc-network", "Android Speech Recognition and Synthesis from Google sv-se-x-dmc-local"], nativeID: ["sv-se-x-dmc-network", "sv-se-x-dmc-local"], language: "sv-SE", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], l$4 = {
  language: "sv",
  defaultRegion: e$8,
  testUtterance: a$8,
  voices: o$6
};

var svCicHwXe4 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: l$4,
  defaultRegion: e$8,
  language: n$6,
  testUtterance: a$8,
  voices: o$6
});

const r$1 = "ta", a$7 = "ta-IN", e$7 = "வணக்கம், என் பெயர் {name} மற்றும் நான் ஒரு தமிழ் குரல்", l$3 = [{ label: "Pallavi", name: "Microsoft Pallavi Online (Natural) - Tamil (India)", language: "ta-IN", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Valluvar", name: "Microsoft Valluvar Online (Natural) - Tamil (India)", language: "ta-IN", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Saranya", name: "Microsoft Saranya Online (Natural) - Tamil (Sri Lanka)", language: "ta-LK", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Kumar", name: "Microsoft Kumar Online (Natural) - Tamil (Sri Lanka)", language: "ta-LK", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Kani", name: "Microsoft Kani Online (Natural) - Tamil (Malaysia)", language: "ta-MY", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Surya", name: "Microsoft Surya Online (Natural) - Tamil (Malaysia)", language: "ta-MY", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Venba", name: "Microsoft Venba Online (Natural) - Tamil (Singapore)", language: "ta-SG", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Anbu", name: "Microsoft Anbu Online (Natural) - Tamil (Singapore)", language: "ta-SG", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Vani", name: "Vani", localizedName: "apple", language: "ta-IN", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Valluvar", name: "Microsoft Valluvar - Tamil (India)", language: "ta-IN", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "பெண் குரல்", name: "Android Speech Recognition and Synthesis from Google ta-in-x-tac-network", altNames: ["Android Speech Recognition and Synthesis from Google ta-in-x-tac-local", "Android Speech Recognition and Synthesis from Google ta-IN-language"], nativeID: ["ta-in-x-tac-network", "ta-in-x-tac-local"], language: "ta-IN", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "ஆண் குரல்", name: "Android Speech Recognition and Synthesis from Google ta-in-x-tad-network", altNames: ["Android Speech Recognition and Synthesis from Google ta-in-x-tad-local"], nativeID: ["ta-in-x-tad-network", "ta-in-x-tad-local"], language: "ta-IN", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], n$5 = {
  language: "ta",
  defaultRegion: a$7,
  testUtterance: e$7,
  voices: l$3
};

var taCvpRY89g = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: n$5,
  defaultRegion: a$7,
  language: r$1,
  testUtterance: e$7,
  voices: l$3
});

const n$4 = "te", e$6 = "te-IN", a$6 = "హలో, నా పేరు {name} మరియు నేను తెలుగు వాణిని.", t$3 = [{ label: "Shruti", name: "Microsoft Shruti Online (Natural) - Telugu (India)", language: "te-IN", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Mohan", name: "Microsoft Mohan Online (Natural) - Telugu (India)", language: "te-IN", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Geeta", name: "Geeta", localizedName: "apple", language: "te-IN", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "స్త్రీ స్వరం", name: "Android Speech Recognition and Synthesis from Google te-in-x-tef-network", altNames: ["Android Speech Recognition and Synthesis from Google te-in-x-tef-local", "Android Speech Recognition and Synthesis from Google te-IN-language"], nativeID: ["te-in-x-tef-network", "te-in-x-tef-local"], language: "te-IN", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "పురుష స్వరం", name: "Android Speech Recognition and Synthesis from Google te-in-x-tem-network", altNames: ["Android Speech Recognition and Synthesis from Google te-in-x-tem-local"], nativeID: ["te-in-x-tem-network", "te-in-x-tem-local"], language: "te-IN", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], o$5 = {
  language: "te",
  defaultRegion: e$6,
  testUtterance: a$6,
  voices: t$3
};

var teD5TcdW9V = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: o$5,
  defaultRegion: e$6,
  language: n$4,
  testUtterance: a$6,
  voices: t$3
});

const t$2 = "th", a$5 = "th-TH", e$5 = "สวัสดีค่ะ ฉันชื่อ {name} และฉันเป็นคนมีเสียงภาษาไทย", l$2 = [{ label: "Premwadee", name: "Microsoft Premwadee Online (Natural) - Thai (Thailand)", language: "th-TH", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Niwat", name: "Microsoft Niwat Online (Natural) - Thai (Thailand)", language: "th-TH", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Narisa", name: "Narisa", localizedName: "apple", language: "th-TH", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Kanya", name: "Kanya", localizedName: "apple", language: "th-TH", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Pattara", name: "Microsoft Pattara - Thai (Thailand)", language: "th-TH", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "เสียงผู้หญิง", name: "Google ไทย (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google th-th-x-mol-network", "Chrome OS ไทย", "Android Speech Recognition and Synthesis from Google th-th-x-mol-local", "Android Speech Recognition and Synthesis from Google th-TH-language"], nativeID: ["th-th-x-mol-network", "th-th-x-mol-local"], language: "th-TH", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], o$4 = {
  language: "th",
  defaultRegion: a$5,
  testUtterance: e$5,
  voices: l$2
};

var thCYakoFVa = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: o$4,
  defaultRegion: a$5,
  language: t$2,
  testUtterance: e$5,
  voices: l$2
});

const o$3 = "tr", e$4 = "tr-TR", r = "Merhaba, adım {name} ve Türk sesiyim.", a$4 = [{ label: "Emel", name: "Microsoft Emel Online (Natural) - Turkish (Turkey)", language: "tr-TR", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Ahmet", name: "Microsoft Ahmet Online (Natural) - Turkish (Türkiye)", language: "tr-TR", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Yelda", name: "Yelda", localizedName: "apple", altNames: ["Yelda (Geliştirilmiş)", "Yelda (Türkçe (Türkiye))"], language: "tr-TR", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Cem", name: "Cem", localizedName: "apple", language: "tr-TR", gender: "male", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"] }, { label: "Tolga", name: "Microsoft Tolga - Turkish (Turkey)", language: "tr-TR", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Kadın sesi 1", name: "Google Türkçe 3 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google tr-tr-x-cfs-network", "Chrome OS Türkçe 3", "Android Speech Recognition and Synthesis from Google tr-tr-x-cfs-local", "Android Speech Recognition and Synthesis from Google tr-TR-language"], nativeID: ["tr-tr-x-cfs-network", "tr-tr-x-cfs-local"], language: "tr-TR", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Kadın sesi 2", name: "Google Türkçe 4 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google tr-tr-x-efu-network", "Chrome OS Türkçe 4", "Android Speech Recognition and Synthesis from Google tr-tr-x-efu-local"], nativeID: ["tr-tr-x-efu-network", "tr-tr-x-efu-local"], language: "tr-TR", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Kadın sesi 3", name: "Google Türkçe 1 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google tr-tr-x-mfm-network", "Chrome OS Türkçe 1", "Android Speech Recognition and Synthesis from Google tr-tr-x-mfm-local"], nativeID: ["tr-tr-x-mfm-network", "tr-tr-x-mfm-local"], language: "tr-TR", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Erkek sesi 1", name: "Google Türkçe 2 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google tr-tr-x-ama-network", "Chrome OS Türkçe 2", "Android Speech Recognition and Synthesis from Google tr-tr-x-ama-local"], nativeID: ["tr-tr-x-ama-network", "tr-tr-x-ama-local"], language: "tr-TR", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Erkek sesi 2", name: "Google Türkçe 5 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google tr-tr-x-tmc-network", "Chrome OS Türkçe 5", "Android Speech Recognition and Synthesis from Google tr-tr-x-tmc-local"], nativeID: ["tr-tr-x-tmc-network", "tr-tr-x-tmc-local"], language: "tr-TR", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], t$1 = {
  language: "tr",
  defaultRegion: e$4,
  testUtterance: r,
  voices: a$4
};

var trBfYrcAz7 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: t$1,
  defaultRegion: e$4,
  language: o$3,
  testUtterance: r,
  voices: a$4
});

const o$2 = "uk", e$3 = "uk-UA", a$3 = "Здравствуйте, меня зовут {name} и я украинский голос.", n$3 = [{ label: "Polina", name: "Microsoft Polina Online (Natural) - Ukrainian (Ukraine)", language: "uk-UA", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Ostap", name: "Microsoft Ostap Online (Natural) - Ukrainian (Ukraine)", language: "uk-UA", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Lesya", name: "Lesya", localizedName: "apple", language: "uk-UA", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Жіночий голос", name: "Google українська (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google uk-ua-x-hfd-network", "Chrome OS українська", "Android Speech Recognition and Synthesis from Google uk-ua-x-hfd-local", "Android Speech Recognition and Synthesis from Google uk-UA-language"], nativeID: ["uk-ua-x-hfd-network", "uk-ua-x-hfd-local"], language: "uk-UA", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], l$1 = {
  language: "uk",
  defaultRegion: e$3,
  testUtterance: a$3,
  voices: n$3
};

var ukBVs6lQbX = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: l$1,
  defaultRegion: e$3,
  language: o$2,
  testUtterance: a$3,
  voices: n$3
});

const o$1 = "vi", e$2 = "vi-VN", n$2 = "Xin chào, tôi tên là {name} và tôi là giọng nói tiếng Việt.", i = [{ label: "HoaiMy", name: "Microsoft HoaiMy Online (Natural) - Vietnamese (Vietnam)", language: "vi-VN", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "NamMinh", name: "Microsoft NamMinh Online (Natural) - Vietnamese (Vietnam)", language: "vi-VN", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Linh", name: "Linh", localizedName: "apple", language: "vi-VN", gender: "female", quality: ["low", "normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "An", name: "Microsoft An - Vietnamese (Vietnam)", language: "vi-VN", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Giọng nữ 1", name: "Google Tiếng Việt 1 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google vi-vn-x-vic-network", "Chrome OS Tiếng Việt 1", "Android Speech Recognition and Synthesis from Google vi-vn-x-vic-local", "Android Speech Recognition and Synthesis from Google vi-VN-language"], nativeID: ["vi-vn-x-vic-network", "vi-vn-x-vic-local"], language: "vi-VN", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Giọng nữ 2", name: "Google Tiếng Việt 2 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google vi-vn-x-vid-network", "Chrome OS Tiếng Việt 2", "Android Speech Recognition and Synthesis from Google vi-vn-x-vid-local"], nativeID: ["vi-vn-x-vid-network", "vi-vn-x-vid-local"], language: "vi-VN", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Giọng nữ 3", name: "Google Tiếng Việt 4 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google vi-vn-x-vif-network", "Chrome OS Tiếng Việt 4", "Android Speech Recognition and Synthesis from Google vi-vn-x-vif-local"], nativeID: ["vi-vn-x-vif-network", "vi-vn-x-vif-local"], language: "vi-VN", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Giọng nam 1", name: "Google Tiếng Việt 3 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google vi-vn-x-vie-network", "Chrome OS Tiếng Việt 3", "Android Speech Recognition and Synthesis from Google vi-vn-x-vie-local"], nativeID: ["vi-vn-x-vie-network", "vi-vn-x-vie-local"], language: "vi-VN", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "Giọng nam 2", name: "Google Tiếng Việt 5 (Natural)", altNames: ["Android Speech Recognition and Synthesis from Google vi-vn-x-gft-network", "Chrome OS Tiếng Việt 5", "Android Speech Recognition and Synthesis from Google vi-vn-x-gft-local"], nativeID: ["vi-vn-x-gft-network", "vi-vn-x-gft-local"], language: "vi-VN", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], a$2 = {
  language: "vi",
  defaultRegion: e$2,
  testUtterance: n$2,
  voices: i
};

var viDP1xN9KL = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: a$2,
  defaultRegion: e$2,
  language: o$1,
  testUtterance: n$2,
  voices: i
});

const t = "wuu", a$1 = "wuu-CN", e$1 = "你好，我的名字是 {name}，我是吴语配音。", n$1 = [{ label: "Nannan", name: "Nannan", localizedName: "apple", language: "wuu-CN", altLanguage: "zh-CN", gender: "female", quality: ["normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }], u = {
  language: "wuu",
  defaultRegion: a$1,
  testUtterance: e$1,
  voices: n$1
};

var wuuC6uQvT6g = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: u,
  defaultRegion: a$1,
  language: t,
  testUtterance: e$1,
  voices: n$1
});

const o = "yue", e = "yue-HK", a = "你好，我叫 {name}，係越中文聲。", n = [{ label: "HiuGaai", name: "Microsoft HiuGaai Online (Natural) - Chinese (Cantonese Traditional)", language: "yue-HK", altLanguage: "zh-HK", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "HiuMaan", name: "Microsoft HiuMaan Online (Natural) - Chinese (Hong Kong SAR)", language: "yue-HK", altLanguage: "zh-HK", gender: "female", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "WanLung", name: "Microsoft WanLung Online (Natural) - Chinese (Hong Kong SAR)", language: "yue-HK", altLanguage: "zh-HK", gender: "male", quality: ["veryHigh"], rate: 1, browser: ["Edge"], preloaded: true, controls: { pitch: false, boundary: false } }, { label: "Google 女聲", name: "Google 粤語（香港）", note: "This voice is pre-loaded in Chrome on desktop. Utterances that are longer than 14 seconds long can trigger a bug with this voice, check the notes in the project's README for more information.", language: "yue-HK", altLanguage: "zh-HK", gender: "female", quality: ["high"], rate: 1, pitch: 1, controls: { boundary: false }, browser: ["ChromeDesktop"], preloaded: true }, { label: "Sinji", name: "Sinji", localizedName: "apple", language: "yue-HK", altLanguage: "zh-HK", gender: "female", quality: ["low", "normal", "high"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Aasing", name: "Aasing", localizedName: "apple", language: "yue-HK", altLanguage: "zh-HK", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["macOS", "iOS", "iPadOS"], preloaded: true }, { label: "Tracy", name: "Microsoft Tracy - Chinese (Traditional, Hong Kong S.A.R.)", language: "cmn-HK", altLanguage: "zh-HK", gender: "female", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "Danny", name: "Microsoft Danny - Chinese (Traditional, Hong Kong S.A.R.)", language: "cmn-HK", altLanguage: "zh-HK", gender: "male", quality: ["normal"], rate: 1, pitch: 1, os: ["Windows"], preloaded: true }, { label: "女聲1", name: "Android Speech Recognition and Synthesis from Google yue-hk-x-jar-network", altNames: ["Chrome OS 粵語 1", "Android Speech Recognition and Synthesis from Google yue-HK-x-jar-local", "Android Speech Recognition and Synthesis from Google yue-HK-language"], nativeID: ["yue-hk-x-jar-network", "yue-hk-x-jar-local"], language: "yue-HK", altLanguage: "zh-HK", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "女聲2", name: "Android Speech Recognition and Synthesis from Google yue-hk-x-yuc-network", altNames: ["Chrome OS 粵語 2", "Android Speech Recognition and Synthesis from Google yue-HK-x-yuc-local"], nativeID: ["yue-hk-x-yuc-network", "yue-hk-x-yuc-local"], language: "yue-HK", altLanguage: "zh-HK", gender: "female", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "男聲1", name: "Android Speech Recognition and Synthesis from Google yue-hk-x-yud-network", altNames: ["Chrome OS 粵語 3", "Android Speech Recognition and Synthesis from Google yue-HK-x-yud-local"], nativeID: ["yue-hk-x-yud-network", "yue-hk-x-yud-local"], language: "yue-HK", altLanguage: "zh-HK", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "男聲2", name: "Android Speech Recognition and Synthesis from Google yue-hk-x-yue-network", altNames: ["Chrome OS 粵語 5", "Android Speech Recognition and Synthesis from Google yue-HK-x-yue-local"], nativeID: ["yue-hk-x-yue-network", "yue-hk-x-yue-local"], language: "yue-HK", altLanguage: "zh-HK", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }, { label: "男聲3", name: "Android Speech Recognition and Synthesis from Google yue-hk-x-yuf-network", altNames: ["Chrome OS 粵語 5", "Android Speech Recognition and Synthesis from Google yue-HK-x-yuf-local"], nativeID: ["yue-hk-x-yuf-network", "yue-hk-x-yuf-local"], language: "yue-HK", altLanguage: "zh-HK", gender: "male", quality: ["high"], rate: 1, pitch: 1, os: ["Android", "ChromeOS"], preloaded: true, controls: { boundary: false } }], l = {
  language: "yue",
  defaultRegion: e,
  testUtterance: a,
  voices: n
};

var yueC8kEWdfv = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: l,
  defaultRegion: e,
  language: o,
  testUtterance: a,
  voices: n
});

export { activate };
