var TilesRendererLib = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // package/src/index.js
  var index_exports = {};
  __export(index_exports, {
    B3DMLoader: () => B3DMLoader,
    B3DMLoaderBase: () => B3DMLoaderBase,
    CMPTLoader: () => CMPTLoader,
    CMPTLoaderBase: () => CMPTLoaderBase,
    CUSTOM_COLOR: () => CUSTOM_COLOR,
    CesiumIonTilesRenderer: () => CesiumIonTilesRenderer,
    DEPTH: () => DEPTH,
    DISTANCE: () => DISTANCE,
    DebugCesiumIonTilesRenderer: () => DebugCesiumIonTilesRenderer,
    DebugGoogleTilesRenderer: () => DebugGoogleTilesRenderer,
    DebugTilesRenderer: () => DebugTilesRenderer,
    Ellipsoid: () => Ellipsoid,
    EllipsoidRegion: () => EllipsoidRegion,
    EllipsoidRegionHelper: () => EllipsoidRegionHelper,
    EllipsoidRegionLineHelper: () => EllipsoidRegionLineHelper,
    EnvironmentControls: () => EnvironmentControls,
    FAILED: () => FAILED,
    GEOMETRIC_ERROR: () => GEOMETRIC_ERROR,
    GLTFCesiumRTCExtension: () => GLTFCesiumRTCExtension,
    GLTFExtensionLoader: () => GLTFExtensionLoader,
    GeoUtils: () => GeoUtils_exports,
    GlobeControls: () => GlobeControls,
    GoogleTilesRenderer: () => GoogleTilesRenderer,
    I3DMLoader: () => I3DMLoader,
    I3DMLoaderBase: () => I3DMLoaderBase,
    IS_LEAF: () => IS_LEAF,
    LOADED: () => LOADED,
    LOADING: () => LOADING,
    LOAD_ORDER: () => LOAD_ORDER,
    LRUCache: () => LRUCache,
    LoaderBase: () => LoaderBase,
    NONE: () => NONE,
    PARSING: () => PARSING,
    PNTSLoader: () => PNTSLoader,
    PNTSLoaderBase: () => PNTSLoaderBase,
    PriorityQueue: () => PriorityQueue,
    RANDOM_COLOR: () => RANDOM_COLOR,
    RANDOM_NODE_COLOR: () => RANDOM_NODE_COLOR,
    RELATIVE_DEPTH: () => RELATIVE_DEPTH,
    SCREEN_ERROR: () => SCREEN_ERROR,
    SphereHelper: () => SphereHelper,
    TilesRenderer: () => TilesRenderer,
    TilesRendererBase: () => TilesRendererBase,
    UNLOADED: () => UNLOADED,
    WGS84_ELLIPSOID: () => WGS84_ELLIPSOID,
    WGS84_FLATTENING: () => WGS84_FLATTENING,
    WGS84_HEIGHT: () => WGS84_HEIGHT,
    WGS84_RADIUS: () => WGS84_RADIUS
  });

  // package/src/three/DebugTilesRenderer.js
  var import_three20 = __require("three");

  // package/src/three/utilities.js
  var import_three = __require("three");
  var colors = {};
  function getIndexedRandomColor(index) {
    if (!colors[index]) {
      const h = Math.random();
      const s = 0.5 + Math.random() * 0.5;
      const l = 0.375 + Math.random() * 0.25;
      colors[index] = new import_three.Color().setHSL(h, s, l);
    }
    return colors[index];
  }

  // package/src/utilities/urlExtension.js
  function getUrlExtension(url) {
    let parsedUrl;
    try {
      parsedUrl = new URL(url, "http://fakehost.com/");
    } catch (_) {
      return null;
    }
    const filename = parsedUrl.pathname.split("/").pop();
    const dotIndex = filename.lastIndexOf(".");
    if (dotIndex === -1 || dotIndex === filename.length - 1) {
      return null;
    }
    const extension = filename.substring(dotIndex + 1);
    return extension;
  }

  // package/src/utilities/LRUCache.js
  function enqueueMicrotask(callback) {
    Promise.resolve().then(callback);
  }
  var LRUCache = class {
    constructor() {
      this.maxSize = 800;
      this.minSize = 600;
      this.unloadPercent = 0.05;
      this.itemSet = /* @__PURE__ */ new Map();
      this.itemList = [];
      this.usedSet = /* @__PURE__ */ new Set();
      this.callbacks = /* @__PURE__ */ new Map();
      this.unloadPriorityCallback = null;
      const itemSet = this.itemSet;
      this.defaultPriorityCallback = (item) => itemSet.get(item);
    }
    // Returns whether or not the cache has reached the maximum size
    isFull() {
      return this.itemSet.size >= this.maxSize;
    }
    add(item, removeCb) {
      const itemSet = this.itemSet;
      if (itemSet.has(item)) {
        return false;
      }
      if (this.isFull()) {
        return false;
      }
      const usedSet = this.usedSet;
      const itemList = this.itemList;
      const callbacks = this.callbacks;
      itemList.push(item);
      usedSet.add(item);
      itemSet.set(item, Date.now());
      callbacks.set(item, removeCb);
      return true;
    }
    remove(item) {
      const usedSet = this.usedSet;
      const itemSet = this.itemSet;
      const itemList = this.itemList;
      const callbacks = this.callbacks;
      if (itemSet.has(item)) {
        callbacks.get(item)(item);
        const index = itemList.indexOf(item);
        itemList.splice(index, 1);
        usedSet.delete(item);
        itemSet.delete(item);
        callbacks.delete(item);
        return true;
      }
      return false;
    }
    markUsed(item) {
      const itemSet = this.itemSet;
      const usedSet = this.usedSet;
      if (itemSet.has(item) && !usedSet.has(item)) {
        itemSet.set(item, Date.now());
        usedSet.add(item);
      }
    }
    markAllUnused() {
      this.usedSet.clear();
    }
    // TODO: this should be renamed because it's not necessarily unloading all unused content
    // Maybe call it "cleanup" or "unloadToMinSize"
    unloadUnusedContent() {
      const unloadPercent = this.unloadPercent;
      const targetSize = this.minSize;
      const itemList = this.itemList;
      const itemSet = this.itemSet;
      const usedSet = this.usedSet;
      const callbacks = this.callbacks;
      const unused = itemList.length - usedSet.size;
      const excess = itemList.length - targetSize;
      const unloadPriorityCallback = this.unloadPriorityCallback || this.defaultPriorityCallback;
      if (excess > 0 && unused > 0) {
        itemList.sort((a, b) => {
          const usedA = usedSet.has(a);
          const usedB = usedSet.has(b);
          if (usedA && usedB) {
            return 0;
          } else if (!usedA && !usedB) {
            return unloadPriorityCallback(b) - unloadPriorityCallback(a);
          } else {
            return usedA ? 1 : -1;
          }
        });
        const unusedExcess = Math.min(excess, unused);
        const maxUnload = Math.max(targetSize * unloadPercent, unusedExcess * unloadPercent);
        let nodesToUnload = Math.min(maxUnload, unused);
        nodesToUnload = Math.ceil(nodesToUnload);
        const removedItems = itemList.splice(0, nodesToUnload);
        for (let i = 0, l = removedItems.length; i < l; i++) {
          const item = removedItems[i];
          callbacks.get(item)(item);
          itemSet.delete(item);
          callbacks.delete(item);
        }
      }
    }
    scheduleUnload(markAllUnused = true) {
      if (!this.scheduled) {
        this.scheduled = true;
        enqueueMicrotask(() => {
          this.scheduled = false;
          this.unloadUnusedContent();
          if (markAllUnused) {
            this.markAllUnused();
          }
        });
      }
    }
  };

  // package/src/utilities/PriorityQueue.js
  var PriorityQueue = class {
    constructor() {
      this.maxJobs = 6;
      this.items = [];
      this.callbacks = /* @__PURE__ */ new Map();
      this.currJobs = 0;
      this.scheduled = false;
      this.autoUpdate = true;
      this.priorityCallback = () => {
        throw new Error("PriorityQueue: PriorityCallback function not defined.");
      };
      this.schedulingCallback = (func) => {
        requestAnimationFrame(func);
      };
      this._runjobs = () => {
        this.tryRunJobs();
        this.scheduled = false;
      };
    }
    sort() {
      const priorityCallback2 = this.priorityCallback;
      const items = this.items;
      items.sort(priorityCallback2);
    }
    add(item, callback) {
      return new Promise((resolve, reject) => {
        const prCallback = (...args) => callback(...args).then(resolve).catch(reject);
        const items = this.items;
        const callbacks = this.callbacks;
        items.push(item);
        callbacks.set(item, prCallback);
        if (this.autoUpdate) {
          this.scheduleJobRun();
        }
      });
    }
    remove(item) {
      const items = this.items;
      const callbacks = this.callbacks;
      const index = items.indexOf(item);
      if (index !== -1) {
        items.splice(index, 1);
        callbacks.delete(item);
      }
    }
    tryRunJobs() {
      this.sort();
      const items = this.items;
      const callbacks = this.callbacks;
      const maxJobs = this.maxJobs;
      let currJobs = this.currJobs;
      while (maxJobs > currJobs && items.length > 0) {
        currJobs++;
        const item = items.pop();
        const callback = callbacks.get(item);
        callbacks.delete(item);
        callback(item).then(() => {
          this.currJobs--;
          if (this.autoUpdate) {
            this.scheduleJobRun();
          }
        }).catch(() => {
          this.currJobs--;
          if (this.autoUpdate) {
            this.scheduleJobRun();
          }
        });
      }
      this.currJobs = currJobs;
    }
    scheduleJobRun() {
      if (!this.scheduled) {
        this.schedulingCallback(this._runjobs);
        this.scheduled = true;
      }
    }
  };

  // package/src/base/constants.js
  var UNLOADED = 0;
  var LOADING = 1;
  var PARSING = 2;
  var LOADED = 3;
  var FAILED = 4;
  var WGS84_RADIUS = 6378137;
  var WGS84_FLATTENING = 1 / 298.257223563;
  var WGS84_HEIGHT = -(WGS84_FLATTENING * WGS84_RADIUS - WGS84_RADIUS);

  // package/src/base/traverseFunctions.js
  function isDownloadFinished(value) {
    return value === LOADED || value === FAILED;
  }
  function isUsedThisFrame(tile, frameCount) {
    return tile.__lastFrameVisited === frameCount && tile.__used;
  }
  function resetFrameState(tile, frameCount) {
    if (tile.__lastFrameVisited !== frameCount) {
      tile.__lastFrameVisited = frameCount;
      tile.__used = false;
      tile.__inFrustum = false;
      tile.__isLeaf = false;
      tile.__visible = false;
      tile.__active = false;
      tile.__error = Infinity;
      tile.__distanceFromCamera = Infinity;
      tile.__childrenWereVisible = false;
      tile.__allChildrenLoaded = false;
    }
  }
  function recursivelyMarkUsed(tile, frameCount, lruCache, renderer) {
    renderer.ensureChildrenArePreprocessed(tile);
    resetFrameState(tile, frameCount);
    tile.__used = true;
    lruCache.markUsed(tile);
    if (tile.__contentEmpty) {
      const children = tile.children;
      for (let i = 0, l = children.length; i < l; i++) {
        recursivelyMarkUsed(children[i], frameCount, lruCache, renderer);
      }
    }
  }
  function recursivelyLoadTiles(tile, depthFromRenderedParent, renderer) {
    renderer.ensureChildrenArePreprocessed(tile);
    const doTraverse = tile.__contentEmpty && (!tile.__externalTileSet || isDownloadFinished(tile.__loadingState));
    if (doTraverse) {
      const children = tile.children;
      for (let i = 0, l = children.length; i < l; i++) {
        const child = children[i];
        child.__depthFromRenderedParent = depthFromRenderedParent;
        recursivelyLoadTiles(child, depthFromRenderedParent, renderer);
      }
    } else {
      renderer.requestTileContents(tile);
    }
  }
  function traverseSet(tile, beforeCb = null, afterCb = null, parent = null, depth = 0) {
    if (beforeCb && beforeCb(tile, parent, depth)) {
      if (afterCb) {
        afterCb(tile, parent, depth);
      }
      return;
    }
    const children = tile.children;
    for (let i = 0, l = children.length; i < l; i++) {
      traverseSet(children[i], beforeCb, afterCb, tile, depth + 1);
    }
    if (afterCb) {
      afterCb(tile, parent, depth);
    }
  }
  function determineFrustumSet(tile, renderer) {
    renderer.ensureChildrenArePreprocessed(tile);
    const stats = renderer.stats;
    const frameCount = renderer.frameCount;
    const errorTarget = renderer.errorTarget;
    const maxDepth = renderer.maxDepth;
    const loadSiblings = renderer.loadSiblings;
    const lruCache = renderer.lruCache;
    const stopAtEmptyTiles = renderer.stopAtEmptyTiles;
    resetFrameState(tile, frameCount);
    const inFrustum = renderer.tileInView(tile);
    if (inFrustum === false) {
      return false;
    }
    tile.__used = true;
    lruCache.markUsed(tile);
    tile.__inFrustum = true;
    stats.inFrustum++;
    if ((stopAtEmptyTiles || !tile.__contentEmpty) && !tile.__externalTileSet) {
      renderer.calculateError(tile);
      const error = tile.__error;
      if (error <= errorTarget) {
        return true;
      }
      if (renderer.maxDepth > 0 && tile.__depth + 1 >= maxDepth) {
        return true;
      }
    }
    let anyChildrenUsed = false;
    const children = tile.children;
    for (let i = 0, l = children.length; i < l; i++) {
      const c = children[i];
      const r = determineFrustumSet(c, renderer);
      anyChildrenUsed = anyChildrenUsed || r;
    }
    if (anyChildrenUsed && loadSiblings) {
      for (let i = 0, l = children.length; i < l; i++) {
        const c = children[i];
        recursivelyMarkUsed(c, frameCount, lruCache, renderer);
      }
    }
    return true;
  }
  function markUsedSetLeaves(tile, renderer) {
    const stats = renderer.stats;
    const frameCount = renderer.frameCount;
    if (!isUsedThisFrame(tile, frameCount)) {
      return;
    }
    stats.used++;
    const children = tile.children;
    let anyChildrenUsed = false;
    for (let i = 0, l = children.length; i < l; i++) {
      const c = children[i];
      anyChildrenUsed = anyChildrenUsed || isUsedThisFrame(c, frameCount);
    }
    if (!anyChildrenUsed) {
      tile.__isLeaf = true;
    } else {
      let childrenWereVisible = false;
      let allChildrenLoaded = true;
      for (let i = 0, l = children.length; i < l; i++) {
        const c = children[i];
        markUsedSetLeaves(c, renderer);
        childrenWereVisible = childrenWereVisible || c.__wasSetVisible || c.__childrenWereVisible;
        if (isUsedThisFrame(c, frameCount)) {
          const childLoaded = c.__allChildrenLoaded || !c.__contentEmpty && isDownloadFinished(c.__loadingState) || !c.__externalTileSet && c.__contentEmpty && c.children.length === 0 || c.__externalTileSet && c.__loadingState === FAILED;
          allChildrenLoaded = allChildrenLoaded && childLoaded;
        }
      }
      tile.__childrenWereVisible = childrenWereVisible;
      tile.__allChildrenLoaded = allChildrenLoaded;
    }
  }
  function skipTraversal(tile, renderer) {
    const stats = renderer.stats;
    const frameCount = renderer.frameCount;
    if (!isUsedThisFrame(tile, frameCount)) {
      return;
    }
    const parent = tile.parent;
    const parentDepthToParent = parent ? parent.__depthFromRenderedParent : -1;
    tile.__depthFromRenderedParent = parentDepthToParent;
    const lruCache = renderer.lruCache;
    if (tile.__isLeaf) {
      tile.__depthFromRenderedParent++;
      if (tile.__loadingState === LOADED) {
        if (tile.__inFrustum) {
          tile.__visible = true;
          stats.visible++;
        }
        tile.__active = true;
        stats.active++;
      } else if (!lruCache.isFull() && (!tile.__contentEmpty || tile.__externalTileSet)) {
        renderer.requestTileContents(tile);
      }
      return;
    }
    const errorRequirement = (renderer.errorTarget + 1) * renderer.errorThreshold;
    const meetsSSE = tile.__error <= errorRequirement;
    const includeTile = meetsSSE || tile.refine === "ADD";
    const hasModel = !tile.__contentEmpty;
    const hasContent = hasModel || tile.__externalTileSet;
    const loadedContent = isDownloadFinished(tile.__loadingState) && hasContent;
    const childrenWereVisible = tile.__childrenWereVisible;
    const children = tile.children;
    const allChildrenHaveContent = tile.__allChildrenLoaded;
    if (includeTile && hasModel) {
      tile.__depthFromRenderedParent++;
    }
    if (includeTile && !loadedContent && !lruCache.isFull() && hasContent) {
      renderer.requestTileContents(tile);
    }
    if (meetsSSE && !allChildrenHaveContent && !childrenWereVisible && loadedContent || tile.refine === "ADD" && loadedContent) {
      if (tile.__inFrustum) {
        tile.__visible = true;
        stats.visible++;
      }
      tile.__active = true;
      stats.active++;
    }
    if (tile.refine !== "ADD" && meetsSSE && !allChildrenHaveContent && loadedContent) {
      for (let i = 0, l = children.length; i < l; i++) {
        const c = children[i];
        if (isUsedThisFrame(c, frameCount) && !lruCache.isFull()) {
          c.__depthFromRenderedParent = tile.__depthFromRenderedParent + 1;
          recursivelyLoadTiles(c, c.__depthFromRenderedParent, renderer);
        }
      }
    } else {
      for (let i = 0, l = children.length; i < l; i++) {
        const c = children[i];
        if (isUsedThisFrame(c, frameCount)) {
          skipTraversal(c, renderer);
        }
      }
    }
  }
  function toggleTiles(tile, renderer) {
    const frameCount = renderer.frameCount;
    const isUsed = isUsedThisFrame(tile, frameCount);
    if (isUsed || tile.__usedLastFrame) {
      let setActive = false;
      let setVisible = false;
      if (isUsed) {
        setActive = tile.__active;
        if (renderer.displayActiveTiles) {
          setVisible = tile.__active || tile.__visible;
        } else {
          setVisible = tile.__visible;
        }
      }
      if (!tile.__contentEmpty && tile.__loadingState === LOADED) {
        if (tile.__wasSetActive !== setActive) {
          renderer.setTileActive(tile, setActive);
        }
        if (tile.__wasSetVisible !== setVisible) {
          renderer.setTileVisible(tile, setVisible);
        }
      }
      tile.__wasSetActive = setActive;
      tile.__wasSetVisible = setVisible;
      tile.__usedLastFrame = isUsed;
      const children = tile.children;
      for (let i = 0, l = children.length; i < l; i++) {
        const c = children[i];
        toggleTiles(c, renderer);
      }
    }
  }

  // package/src/base/TilesRendererBase.js
  var priorityCallback = (a, b) => {
    if (a.__depth !== b.__depth) {
      return a.__depth > b.__depth ? -1 : 1;
    } else if (a.__inFrustum !== b.__inFrustum) {
      return a.__inFrustum ? 1 : -1;
    } else if (a.__used !== b.__used) {
      return a.__used ? 1 : -1;
    } else if (a.__error !== b.__error) {
      return a.__error > b.__error ? 1 : -1;
    } else if (a.__distanceFromCamera !== b.__distanceFromCamera) {
      return a.__distanceFromCamera > b.__distanceFromCamera ? -1 : 1;
    }
    return 0;
  };
  var lruPriorityCallback = (tile) => 1 / (tile.__depthFromRenderedParent + 1);
  var TilesRendererBase = class {
    get rootTileSet() {
      const tileSet = this.tileSets[this.rootURL];
      if (!tileSet || tileSet instanceof Promise) {
        return null;
      } else {
        return tileSet;
      }
    }
    get root() {
      const tileSet = this.rootTileSet;
      return tileSet ? tileSet.root : null;
    }
    constructor(url) {
      this.tileSets = {};
      this.rootURL = url;
      this.fetchOptions = {};
      this.preprocessURL = null;
      const lruCache = new LRUCache();
      lruCache.unloadPriorityCallback = lruPriorityCallback;
      const downloadQueue = new PriorityQueue();
      downloadQueue.maxJobs = 4;
      downloadQueue.priorityCallback = priorityCallback;
      const parseQueue = new PriorityQueue();
      parseQueue.maxJobs = 1;
      parseQueue.priorityCallback = priorityCallback;
      this.lruCache = lruCache;
      this.downloadQueue = downloadQueue;
      this.parseQueue = parseQueue;
      this.stats = {
        parsing: 0,
        downloading: 0,
        failed: 0,
        inFrustum: 0,
        used: 0,
        active: 0,
        visible: 0
      };
      this.frameCount = 0;
      this.errorTarget = 6;
      this.errorThreshold = Infinity;
      this.loadSiblings = true;
      this.displayActiveTiles = false;
      this.maxDepth = Infinity;
      this.stopAtEmptyTiles = true;
    }
    traverse(beforecb, aftercb) {
      const tileSets = this.tileSets;
      const rootTileSet = tileSets[this.rootURL];
      if (!rootTileSet || !rootTileSet.root) return;
      traverseSet(rootTileSet.root, (tile, ...args) => {
        this.ensureChildrenArePreprocessed(tile);
        return beforecb ? beforecb(tile, ...args) : false;
      }, aftercb);
    }
    // Public API
    update() {
      const stats = this.stats;
      const lruCache = this.lruCache;
      const tileSets = this.tileSets;
      const rootTileSet = tileSets[this.rootURL];
      if (!(this.rootURL in tileSets)) {
        this.loadRootTileSet(this.rootURL);
        return;
      } else if (!rootTileSet || !rootTileSet.root) {
        return;
      }
      const root = rootTileSet.root;
      stats.inFrustum = 0, stats.used = 0, stats.active = 0, stats.visible = 0, this.frameCount++;
      determineFrustumSet(root, this);
      markUsedSetLeaves(root, this);
      skipTraversal(root, this);
      toggleTiles(root, this);
      lruCache.scheduleUnload();
    }
    // Overrideable
    parseTile(buffer, tile, extension) {
      return null;
    }
    disposeTile(tile) {
    }
    preprocessNode(tile, tileSetDir, parentTile = null) {
      if (tile.content) {
        if (!("uri" in tile.content) && "url" in tile.content) {
          tile.content.uri = tile.content.url;
          delete tile.content.url;
        }
        if (tile.content.uri) {
          tile.content.uri = new URL(tile.content.uri, tileSetDir + "/").toString();
        }
        if (tile.content.boundingVolume && !("box" in tile.content.boundingVolume || "sphere" in tile.content.boundingVolume || "region" in tile.content.boundingVolume)) {
          delete tile.content.boundingVolume;
        }
      }
      tile.parent = parentTile;
      tile.children = tile.children || [];
      const uri = tile.content && tile.content.uri;
      if (uri) {
        const extension = getUrlExtension(tile.content.uri);
        const isExternalTileSet = Boolean(extension && extension.toLowerCase() === "json");
        tile.__externalTileSet = isExternalTileSet;
        tile.__contentEmpty = isExternalTileSet;
      } else {
        tile.__externalTileSet = false;
        tile.__contentEmpty = true;
      }
      tile.__distanceFromCamera = Infinity;
      tile.__error = Infinity;
      tile.__inFrustum = false;
      tile.__isLeaf = false;
      tile.__usedLastFrame = false;
      tile.__used = false;
      tile.__wasSetVisible = false;
      tile.__visible = false;
      tile.__childrenWereVisible = false;
      tile.__allChildrenLoaded = false;
      tile.__wasSetActive = false;
      tile.__active = false;
      tile.__loadingState = UNLOADED;
      tile.__loadIndex = 0;
      tile.__loadAbort = null;
      tile.__depthFromRenderedParent = -1;
      if (parentTile === null) {
        tile.__depth = 0;
        tile.refine = tile.refine || "REPLACE";
      } else {
        tile.__depth = parentTile.__depth + 1;
        tile.refine = tile.refine || parentTile.refine;
      }
      tile.__basePath = tileSetDir;
    }
    setTileActive(tile, state) {
    }
    setTileVisible(tile, state) {
    }
    calculateError(tile) {
      return 0;
    }
    tileInView(tile) {
      return true;
    }
    ensureChildrenArePreprocessed(tile) {
      const children = tile.children;
      for (let i = 0, l = children.length; i < l; i++) {
        const child = children[i];
        if ("__depth" in child) {
          break;
        }
        this.preprocessNode(child, tile.__basePath, tile);
      }
    }
    resetFailedTiles() {
      const stats = this.stats;
      if (stats.failed === 0) {
        return;
      }
      this.traverse((tile) => {
        if (tile.__loadingState === FAILED) {
          tile.__loadingState = UNLOADED;
        }
      });
      stats.failed = 0;
    }
    // Private Functions
    fetchTileSet(url, fetchOptions, parent = null) {
      return fetch(url, fetchOptions).then((res) => {
        if (res.ok) {
          return res.json();
        } else {
          throw new Error(`TilesRenderer: Failed to load tileset "${url}" with status ${res.status} : ${res.statusText}`);
        }
      }).then((json) => {
        const version = json.asset.version;
        const [major, minor] = version.split(".").map((v) => parseInt(v));
        console.assert(
          major <= 1,
          "TilesRenderer: asset.version is expected to be a 1.x or a compatible version."
        );
        if (major === 1 && minor > 0) {
          console.warn("TilesRenderer: tiles versions at 1.1 or higher have limited support. Some new extensions and features may not be supported.");
        }
        let basePath = url.replace(/\/[^\/]*\/?$/, "");
        basePath = new URL(basePath, window.location.href).toString();
        this.preprocessNode(json.root, basePath, parent);
        return json;
      });
    }
    loadRootTileSet(url) {
      const tileSets = this.tileSets;
      if (!(url in tileSets)) {
        const pr = this.fetchTileSet(this.preprocessURL ? this.preprocessURL(url) : url, this.fetchOptions).then((json) => {
          tileSets[url] = json;
        });
        pr.catch((err) => {
          console.error(err);
          tileSets[url] = err;
        });
        tileSets[url] = pr;
        return pr;
      } else if (tileSets[url] instanceof Error) {
        return Promise.reject(tileSets[url]);
      } else {
        return Promise.resolve(tileSets[url]);
      }
    }
    requestTileContents(tile) {
      if (tile.__loadingState !== UNLOADED) {
        return;
      }
      const stats = this.stats;
      const lruCache = this.lruCache;
      const downloadQueue = this.downloadQueue;
      const parseQueue = this.parseQueue;
      const isExternalTileSet = tile.__externalTileSet;
      lruCache.add(tile, (t) => {
        if (t.__loadingState === LOADING) {
          t.__loadAbort.abort();
          t.__loadAbort = null;
        } else if (isExternalTileSet) {
          t.children.length = 0;
        } else {
          this.disposeTile(t);
        }
        if (t.__loadingState === LOADING) {
          stats.downloading--;
        } else if (t.__loadingState === PARSING) {
          stats.parsing--;
        }
        t.__loadingState = UNLOADED;
        t.__loadIndex++;
        parseQueue.remove(t);
        downloadQueue.remove(t);
      });
      tile.__loadIndex++;
      const loadIndex = tile.__loadIndex;
      const controller = new AbortController();
      const signal = controller.signal;
      stats.downloading++;
      tile.__loadAbort = controller;
      tile.__loadingState = LOADING;
      const errorCallback = (e) => {
        if (tile.__loadIndex !== loadIndex) {
          return;
        }
        if (e.name !== "AbortError") {
          parseQueue.remove(tile);
          downloadQueue.remove(tile);
          if (tile.__loadingState === PARSING) {
            stats.parsing--;
          } else if (tile.__loadingState === LOADING) {
            stats.downloading--;
          }
          stats.failed++;
          console.error(`TilesRenderer : Failed to load tile at url "${tile.content.uri}".`);
          console.error(e);
          tile.__loadingState = FAILED;
        } else {
          lruCache.remove(tile);
        }
      };
      if (isExternalTileSet) {
        downloadQueue.add(tile, (tileCb) => {
          if (tileCb.__loadIndex !== loadIndex) {
            return Promise.resolve();
          }
          const uri = this.preprocessURL ? this.preprocessURL(tileCb.content.uri) : tileCb.content.uri;
          return this.fetchTileSet(uri, Object.assign({ signal }, this.fetchOptions), tileCb);
        }).then((json) => {
          if (tile.__loadIndex !== loadIndex) {
            return;
          }
          stats.downloading--;
          tile.__loadAbort = null;
          tile.__loadingState = LOADED;
          tile.children.push(json.root);
        }).catch(errorCallback);
      } else {
        downloadQueue.add(tile, (downloadTile) => {
          if (downloadTile.__loadIndex !== loadIndex) {
            return Promise.resolve();
          }
          const uri = this.preprocessURL ? this.preprocessURL(downloadTile.content.uri) : downloadTile.content.uri;
          return fetch(uri, Object.assign({ signal }, this.fetchOptions));
        }).then((res) => {
          if (tile.__loadIndex !== loadIndex) {
            return;
          }
          if (res.ok) {
            return res.arrayBuffer();
          } else {
            throw new Error(`Failed to load model with error code ${res.status}`);
          }
        }).then((buffer) => {
          if (tile.__loadIndex !== loadIndex) {
            return;
          }
          stats.downloading--;
          stats.parsing++;
          tile.__loadAbort = null;
          tile.__loadingState = PARSING;
          return parseQueue.add(tile, (parseTile) => {
            if (parseTile.__loadIndex !== loadIndex) {
              return Promise.resolve();
            }
            const uri = parseTile.content.uri;
            const extension = getUrlExtension(uri);
            return this.parseTile(buffer, parseTile, extension);
          });
        }).then(() => {
          if (tile.__loadIndex !== loadIndex) {
            return;
          }
          stats.parsing--;
          tile.__loadingState = LOADED;
          if (tile.__wasSetVisible) {
            this.setTileVisible(tile, true);
          }
          if (tile.__wasSetActive) {
            this.setTileActive(tile, true);
          }
        }).catch(errorCallback);
      }
    }
    dispose() {
      const lruCache = this.lruCache;
      const toRemove = [];
      this.traverse((t) => {
        toRemove.push(t);
        return false;
      });
      for (let i = 0, l = toRemove.length; i < l; i++) {
        lruCache.remove(toRemove[i]);
      }
      this.stats = {
        parsing: 0,
        downloading: 0,
        failed: 0,
        inFrustum: 0,
        used: 0,
        active: 0,
        visible: 0
      };
      this.frameCount = 0;
    }
  };

  // package/src/utilities/arrayToString.js
  function arrayToString(array) {
    const utf8decoder = new TextDecoder();
    return utf8decoder.decode(array);
  }

  // package/src/utilities/FeatureTable.js
  var FeatureTable = class {
    constructor(buffer, start, headerLength, binLength) {
      this.buffer = buffer;
      this.binOffset = start + headerLength;
      this.binLength = binLength;
      let header = null;
      if (headerLength !== 0) {
        const headerData = new Uint8Array(buffer, start, headerLength);
        header = JSON.parse(arrayToString(headerData));
      } else {
        header = {};
      }
      this.header = header;
    }
    getKeys() {
      return Object.keys(this.header);
    }
    getData(key, count, defaultComponentType = null, defaultType = null) {
      const header = this.header;
      if (!(key in header)) {
        return null;
      }
      const feature = header[key];
      if (!(feature instanceof Object)) {
        return feature;
      } else if (Array.isArray(feature)) {
        return feature;
      } else {
        const { buffer, binOffset, binLength } = this;
        const byteOffset = feature.byteOffset || 0;
        const featureType = feature.type || defaultType;
        const featureComponentType = feature.componentType || defaultComponentType;
        if ("type" in feature && defaultType && feature.type !== defaultType) {
          throw new Error("FeatureTable: Specified type does not match expected type.");
        }
        let stride;
        switch (featureType) {
          case "SCALAR":
            stride = 1;
            break;
          case "VEC2":
            stride = 2;
            break;
          case "VEC3":
            stride = 3;
            break;
          case "VEC4":
            stride = 4;
            break;
          default:
            throw new Error(`FeatureTable : Feature type not provided for "${key}".`);
        }
        let data;
        const arrayStart = binOffset + byteOffset;
        const arrayLength = count * stride;
        switch (featureComponentType) {
          case "BYTE":
            data = new Int8Array(buffer, arrayStart, arrayLength);
            break;
          case "UNSIGNED_BYTE":
            data = new Uint8Array(buffer, arrayStart, arrayLength);
            break;
          case "SHORT":
            data = new Int16Array(buffer, arrayStart, arrayLength);
            break;
          case "UNSIGNED_SHORT":
            data = new Uint16Array(buffer, arrayStart, arrayLength);
            break;
          case "INT":
            data = new Int32Array(buffer, arrayStart, arrayLength);
            break;
          case "UNSIGNED_INT":
            data = new Uint32Array(buffer, arrayStart, arrayLength);
            break;
          case "FLOAT":
            data = new Float32Array(buffer, arrayStart, arrayLength);
            break;
          case "DOUBLE":
            data = new Float64Array(buffer, arrayStart, arrayLength);
            break;
          default:
            throw new Error(`FeatureTable : Feature component type not provided for "${key}".`);
        }
        const dataEnd = arrayStart + arrayLength * data.BYTES_PER_ELEMENT;
        if (dataEnd > binOffset + binLength) {
          throw new Error("FeatureTable: Feature data read outside binary body length.");
        }
        return data;
      }
    }
    getBuffer(byteOffset, byteLength) {
      const { buffer, binOffset } = this;
      return buffer.slice(binOffset + byteOffset, binOffset + byteOffset + byteLength);
    }
  };
  var BatchTable = class extends FeatureTable {
    constructor(buffer, batchSize, start, headerLength, binLength) {
      super(buffer, start, headerLength, binLength);
      this.batchSize = batchSize;
    }
    getData(key, componentType = null, type = null) {
      return super.getData(key, this.batchSize, componentType, type);
    }
  };

  // package/src/base/LoaderBase.js
  var LoaderBase = class {
    constructor() {
      this.fetchOptions = {};
      this.workingPath = "";
    }
    load(url) {
      return fetch(url, this.fetchOptions).then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load file "${url}" with status ${res.status} : ${res.statusText}`);
        }
        return res.arrayBuffer();
      }).then((buffer) => {
        if (this.workingPath === "") {
          this.workingPath = this.workingPathForURL(url);
        }
        return this.parse(buffer);
      });
    }
    resolveExternalURL(url) {
      if (/^[^\\/]/.test(url)) {
        return this.workingPath + "/" + url;
      } else {
        return url;
      }
    }
    workingPathForURL(url) {
      const splits = url.split(/[\\/]/g);
      splits.pop();
      const workingPath = splits.join("/");
      return workingPath + "/";
    }
    parse(buffer) {
      throw new Error("LoaderBase: Parse not implemented.");
    }
  };

  // package/src/utilities/readMagicBytes.js
  function readMagicBytes(bufferOrDataView) {
    let view;
    if (bufferOrDataView instanceof DataView) {
      view = bufferOrDataView;
    } else {
      view = new DataView(bufferOrDataView);
    }
    if (String.fromCharCode(view.getUint8(0)) === "{") {
      return null;
    }
    let magicBytes = "";
    for (let i = 0; i < 4; i++) {
      magicBytes += String.fromCharCode(view.getUint8(i));
    }
    return magicBytes;
  }

  // package/src/base/B3DMLoaderBase.js
  var B3DMLoaderBase = class extends LoaderBase {
    parse(buffer) {
      const dataView = new DataView(buffer);
      const magic = readMagicBytes(dataView);
      console.assert(magic === "b3dm");
      const version = dataView.getUint32(4, true);
      console.assert(version === 1);
      const byteLength = dataView.getUint32(8, true);
      console.assert(byteLength === buffer.byteLength);
      const featureTableJSONByteLength = dataView.getUint32(12, true);
      const featureTableBinaryByteLength = dataView.getUint32(16, true);
      const batchTableJSONByteLength = dataView.getUint32(20, true);
      const batchTableBinaryByteLength = dataView.getUint32(24, true);
      const featureTableStart = 28;
      const featureTableBuffer = buffer.slice(
        featureTableStart,
        featureTableStart + featureTableJSONByteLength + featureTableBinaryByteLength
      );
      const featureTable = new FeatureTable(
        featureTableBuffer,
        0,
        featureTableJSONByteLength,
        featureTableBinaryByteLength
      );
      const batchTableStart = featureTableStart + featureTableJSONByteLength + featureTableBinaryByteLength;
      const batchTableBuffer = buffer.slice(
        batchTableStart,
        batchTableStart + batchTableJSONByteLength + batchTableBinaryByteLength
      );
      const batchTable = new BatchTable(
        batchTableBuffer,
        featureTable.getData("BATCH_LENGTH"),
        0,
        batchTableJSONByteLength,
        batchTableBinaryByteLength
      );
      const glbStart = batchTableStart + batchTableJSONByteLength + batchTableBinaryByteLength;
      const glbBytes = new Uint8Array(buffer, glbStart, byteLength - glbStart);
      return {
        version,
        featureTable,
        batchTable,
        glbBytes
      };
    }
  };

  // package/src/three/B3DMLoader.js
  var import_three2 = __require("three");
  var import_GLTFLoader = __require("three/examples/jsm/loaders/GLTFLoader.js");
  var B3DMLoader = class extends B3DMLoaderBase {
    constructor(manager = import_three2.DefaultLoadingManager) {
      super();
      this.manager = manager;
      this.adjustmentTransform = new import_three2.Matrix4();
    }
    parse(buffer) {
      const b3dm = super.parse(buffer);
      const gltfBuffer = b3dm.glbBytes.slice().buffer;
      return new Promise((resolve, reject) => {
        const manager = this.manager;
        const fetchOptions = this.fetchOptions;
        const loader = manager.getHandler("path.gltf") || new import_GLTFLoader.GLTFLoader(manager);
        if (fetchOptions.credentials === "include" && fetchOptions.mode === "cors") {
          loader.setCrossOrigin("use-credentials");
        }
        if ("credentials" in fetchOptions) {
          loader.setWithCredentials(fetchOptions.credentials === "include");
        }
        if (fetchOptions.headers) {
          loader.setRequestHeader(fetchOptions.headers);
        }
        let workingPath = this.workingPath;
        if (!/[\\/]$/.test(workingPath) && workingPath.length) {
          workingPath += "/";
        }
        const adjustmentTransform = this.adjustmentTransform;
        loader.parse(gltfBuffer, workingPath, (model) => {
          const { batchTable, featureTable } = b3dm;
          const { scene } = model;
          const rtcCenter = featureTable.getData("RTC_CENTER");
          if (rtcCenter) {
            scene.position.x += rtcCenter[0];
            scene.position.y += rtcCenter[1];
            scene.position.z += rtcCenter[2];
          }
          model.scene.updateMatrix();
          model.scene.matrix.multiply(adjustmentTransform);
          model.scene.matrix.decompose(model.scene.position, model.scene.quaternion, model.scene.scale);
          model.batchTable = batchTable;
          model.featureTable = featureTable;
          scene.batchTable = batchTable;
          scene.featureTable = featureTable;
          resolve(model);
        }, reject);
      });
    }
  };

  // package/src/base/PNTSLoaderBase.js
  var PNTSLoaderBase = class extends LoaderBase {
    parse(buffer) {
      const dataView = new DataView(buffer);
      const magic = readMagicBytes(dataView);
      console.assert(magic === "pnts");
      const version = dataView.getUint32(4, true);
      console.assert(version === 1);
      const byteLength = dataView.getUint32(8, true);
      console.assert(byteLength === buffer.byteLength);
      const featureTableJSONByteLength = dataView.getUint32(12, true);
      const featureTableBinaryByteLength = dataView.getUint32(16, true);
      const batchTableJSONByteLength = dataView.getUint32(20, true);
      const batchTableBinaryByteLength = dataView.getUint32(24, true);
      const featureTableStart = 28;
      const featureTableBuffer = buffer.slice(
        featureTableStart,
        featureTableStart + featureTableJSONByteLength + featureTableBinaryByteLength
      );
      const featureTable = new FeatureTable(
        featureTableBuffer,
        0,
        featureTableJSONByteLength,
        featureTableBinaryByteLength
      );
      const batchTableStart = featureTableStart + featureTableJSONByteLength + featureTableBinaryByteLength;
      const batchTableBuffer = buffer.slice(
        batchTableStart,
        batchTableStart + batchTableJSONByteLength + batchTableBinaryByteLength
      );
      const batchTable = new BatchTable(
        batchTableBuffer,
        featureTable.getData("BATCH_LENGTH") || featureTable.getData("POINTS_LENGTH"),
        0,
        batchTableJSONByteLength,
        batchTableBinaryByteLength
      );
      return Promise.resolve({
        version,
        featureTable,
        batchTable
      });
    }
  };

  // package/src/three/PNTSLoader.js
  var import_three3 = __require("three");

  // package/src/utilities/rgb565torgb.js
  function rgb565torgb(rgb565) {
    const red5 = rgb565 >> 11;
    const green6 = rgb565 >> 5 & 63;
    const blue5 = rgb565 & 31;
    const red8 = Math.round(red5 / 31 * 255);
    const green8 = Math.round(green6 / 63 * 255);
    const blue8 = Math.round(blue5 / 31 * 255);
    return [red8, green8, blue8];
  }

  // package/src/three/PNTSLoader.js
  var DRACO_ATTRIBUTE_MAP = {
    RGB: "color",
    POSITION: "position"
  };
  var PNTSLoader = class extends PNTSLoaderBase {
    constructor(manager = import_three3.DefaultLoadingManager) {
      super();
      this.manager = manager;
    }
    parse(buffer) {
      return super.parse(buffer).then(async (result) => {
        const { featureTable } = result;
        const material = new import_three3.PointsMaterial();
        const extensions = featureTable.header.extensions;
        const translationOffset = new import_three3.Vector3();
        let geometry;
        if (extensions && extensions["3DTILES_draco_point_compression"]) {
          const { byteOffset, byteLength, properties } = extensions["3DTILES_draco_point_compression"];
          const dracoLoader = this.manager.getHandler("draco.drc");
          if (dracoLoader == null) {
            throw new Error("PNTSLoader: dracoLoader not available.");
          }
          const attributeIDs = {};
          for (const key in properties) {
            if (key in DRACO_ATTRIBUTE_MAP && key in properties) {
              const mappedKey = DRACO_ATTRIBUTE_MAP[key];
              attributeIDs[mappedKey] = properties[key];
            }
          }
          const taskConfig = {
            attributeIDs,
            attributeTypes: {
              position: "Float32Array",
              color: "Uint8Array"
            },
            useUniqueIDs: true
          };
          const buffer2 = featureTable.getBuffer(byteOffset, byteLength);
          geometry = await dracoLoader.decodeGeometry(buffer2, taskConfig);
          if (geometry.attributes.color) {
            material.vertexColors = true;
          }
        } else {
          const POINTS_LENGTH = featureTable.getData("POINTS_LENGTH");
          const POSITION = featureTable.getData("POSITION", POINTS_LENGTH, "FLOAT", "VEC3");
          const RGB = featureTable.getData("RGB", POINTS_LENGTH, "UNSIGNED_BYTE", "VEC3");
          const RGBA = featureTable.getData("RGBA", POINTS_LENGTH, "UNSIGNED_BYTE", "VEC4");
          const RGB565 = featureTable.getData("RGB565", POINTS_LENGTH, "UNSIGNED_SHORT", "SCALAR");
          const CONSTANT_RGBA = featureTable.getData("CONSTANT_RGBA", POINTS_LENGTH, "UNSIGNED_BYTE", "VEC4");
          const POSITION_QUANTIZED = featureTable.getData("POSITION_QUANTIZED", POINTS_LENGTH, "UNSIGNED_SHORT", "VEC3");
          const QUANTIZED_VOLUME_SCALE = featureTable.getData("QUANTIZED_VOLUME_SCALE", POINTS_LENGTH, "FLOAT", "VEC3");
          const QUANTIZED_VOLUME_OFFSET = featureTable.getData("QUANTIZED_VOLUME_OFFSET", POINTS_LENGTH, "FLOAT", "VEC3");
          geometry = new import_three3.BufferGeometry();
          if (POSITION_QUANTIZED) {
            const decodedPositions = new Float32Array(POINTS_LENGTH * 3);
            for (let i = 0; i < POINTS_LENGTH; i++) {
              for (let j = 0; j < 3; j++) {
                const index = 3 * i + j;
                decodedPositions[index] = POSITION_QUANTIZED[index] / 65535 * QUANTIZED_VOLUME_SCALE[j];
              }
            }
            translationOffset.x = QUANTIZED_VOLUME_OFFSET[0];
            translationOffset.y = QUANTIZED_VOLUME_OFFSET[1];
            translationOffset.z = QUANTIZED_VOLUME_OFFSET[2];
            geometry.setAttribute("position", new import_three3.BufferAttribute(decodedPositions, 3, false));
          } else {
            geometry.setAttribute("position", new import_three3.BufferAttribute(POSITION, 3, false));
          }
          if (RGBA !== null) {
            geometry.setAttribute("color", new import_three3.BufferAttribute(RGBA, 4, true));
            material.vertexColors = true;
            material.transparent = true;
            material.depthWrite = false;
          } else if (RGB !== null) {
            geometry.setAttribute("color", new import_three3.BufferAttribute(RGB, 3, true));
            material.vertexColors = true;
          } else if (RGB565 !== null) {
            const color = new Uint8Array(POINTS_LENGTH * 3);
            for (let i = 0; i < POINTS_LENGTH; i++) {
              const rgbColor = rgb565torgb(RGB565[i]);
              for (let j = 0; j < 3; j++) {
                const index = 3 * i + j;
                color[index] = rgbColor[j];
              }
            }
            geometry.setAttribute("color", new import_three3.BufferAttribute(color, 3, true));
            material.vertexColors = true;
          } else if (CONSTANT_RGBA !== null) {
            const color = new import_three3.Color(CONSTANT_RGBA[0], CONSTANT_RGBA[1], CONSTANT_RGBA[2]);
            material.color = color;
            const opacity = CONSTANT_RGBA[3] / 255;
            if (opacity < 1) {
              material.opacity = opacity;
              material.transparent = true;
              material.depthWrite = false;
            }
          }
        }
        [
          "BATCH_LENGTH",
          "NORMAL",
          "NORMAL_OCT16P"
        ].forEach((feature) => {
          if (feature in featureTable.header) {
            console.warn(
              `PNTSLoader: Unsupported FeatureTable feature "${feature}" detected.`
            );
          }
        });
        const object = new import_three3.Points(geometry, material);
        object.position.copy(translationOffset);
        result.scene = object;
        result.scene.featureTable = featureTable;
        const rtcCenter = featureTable.getData("RTC_CENTER");
        if (rtcCenter) {
          result.scene.position.x += rtcCenter[0];
          result.scene.position.y += rtcCenter[1];
          result.scene.position.z += rtcCenter[2];
        }
        return result;
      });
    }
  };

  // package/src/base/I3DMLoaderBase.js
  var I3DMLoaderBase = class extends LoaderBase {
    parse(buffer) {
      const dataView = new DataView(buffer);
      const magic = readMagicBytes(dataView);
      console.assert(magic === "i3dm");
      const version = dataView.getUint32(4, true);
      console.assert(version === 1);
      const byteLength = dataView.getUint32(8, true);
      console.assert(byteLength === buffer.byteLength);
      const featureTableJSONByteLength = dataView.getUint32(12, true);
      const featureTableBinaryByteLength = dataView.getUint32(16, true);
      const batchTableJSONByteLength = dataView.getUint32(20, true);
      const batchTableBinaryByteLength = dataView.getUint32(24, true);
      const gltfFormat = dataView.getUint32(28, true);
      const featureTableStart = 32;
      const featureTableBuffer = buffer.slice(
        featureTableStart,
        featureTableStart + featureTableJSONByteLength + featureTableBinaryByteLength
      );
      const featureTable = new FeatureTable(
        featureTableBuffer,
        0,
        featureTableJSONByteLength,
        featureTableBinaryByteLength
      );
      const batchTableStart = featureTableStart + featureTableJSONByteLength + featureTableBinaryByteLength;
      const batchTableBuffer = buffer.slice(
        batchTableStart,
        batchTableStart + batchTableJSONByteLength + batchTableBinaryByteLength
      );
      const batchTable = new BatchTable(
        batchTableBuffer,
        featureTable.getData("INSTANCES_LENGTH"),
        0,
        batchTableJSONByteLength,
        batchTableBinaryByteLength
      );
      const glbStart = batchTableStart + batchTableJSONByteLength + batchTableBinaryByteLength;
      const bodyBytes = new Uint8Array(buffer, glbStart, byteLength - glbStart);
      let glbBytes = null;
      let promise = null;
      if (gltfFormat) {
        glbBytes = bodyBytes;
        promise = Promise.resolve();
      } else {
        const externalUri = this.resolveExternalURL(arrayToString(bodyBytes));
        promise = fetch(externalUri, this.fetchOptions).then((res) => {
          if (!res.ok) {
            throw new Error(`I3DMLoaderBase : Failed to load file "${externalUri}" with status ${res.status} : ${res.statusText}`);
          }
          return res.arrayBuffer();
        }).then((buffer2) => {
          glbBytes = new Uint8Array(buffer2);
        });
      }
      return promise.then(() => {
        return {
          version,
          featureTable,
          batchTable,
          glbBytes
        };
      });
    }
  };

  // package/src/three/I3DMLoader.js
  var import_three4 = __require("three");
  var import_GLTFLoader2 = __require("three/examples/jsm/loaders/GLTFLoader.js");
  var tempFwd = new import_three4.Vector3();
  var tempUp = new import_three4.Vector3();
  var tempRight = new import_three4.Vector3();
  var tempPos = new import_three4.Vector3();
  var tempQuat = new import_three4.Quaternion();
  var tempSca = new import_three4.Vector3();
  var tempMat = new import_three4.Matrix4();
  var I3DMLoader = class extends I3DMLoaderBase {
    constructor(manager = import_three4.DefaultLoadingManager) {
      super();
      this.manager = manager;
      this.adjustmentTransform = new import_three4.Matrix4();
    }
    resolveExternalURL(url) {
      return this.manager.resolveURL(super.resolveExternalURL(url));
    }
    parse(buffer) {
      return super.parse(buffer).then((i3dm) => {
        const { featureTable, batchTable } = i3dm;
        const gltfBuffer = i3dm.glbBytes.slice().buffer;
        return new Promise((resolve, reject) => {
          const fetchOptions = this.fetchOptions;
          const manager = this.manager;
          const loader = manager.getHandler("path.gltf") || new import_GLTFLoader2.GLTFLoader(manager);
          if (fetchOptions.credentials === "include" && fetchOptions.mode === "cors") {
            loader.setCrossOrigin("use-credentials");
          }
          if ("credentials" in fetchOptions) {
            loader.setWithCredentials(fetchOptions.credentials === "include");
          }
          if (fetchOptions.headers) {
            loader.setRequestHeader(fetchOptions.headers);
          }
          let workingPath = this.workingPath;
          if (!/[\\/]$/.test(workingPath)) {
            workingPath += "/";
          }
          const adjustmentTransform = this.adjustmentTransform;
          loader.parse(gltfBuffer, workingPath, (model) => {
            const INSTANCES_LENGTH = featureTable.getData("INSTANCES_LENGTH");
            const POSITION = featureTable.getData("POSITION", INSTANCES_LENGTH, "FLOAT", "VEC3");
            const NORMAL_UP = featureTable.getData("NORMAL_UP", INSTANCES_LENGTH, "FLOAT", "VEC3");
            const NORMAL_RIGHT = featureTable.getData("NORMAL_RIGHT", INSTANCES_LENGTH, "FLOAT", "VEC3");
            const SCALE_NON_UNIFORM = featureTable.getData("SCALE_NON_UNIFORM", INSTANCES_LENGTH, "FLOAT", "VEC3");
            const SCALE = featureTable.getData("SCALE", INSTANCES_LENGTH, "FLOAT", "SCALAR");
            [
              "RTC_CENTER",
              "QUANTIZED_VOLUME_OFFSET",
              "QUANTIZED_VOLUME_SCALE",
              "EAST_NORTH_UP",
              "POSITION_QUANTIZED",
              "NORMAL_UP_OCT32P",
              "NORMAL_RIGHT_OCT32P"
            ].forEach((feature) => {
              if (feature in featureTable.header) {
                console.warn(`I3DMLoader: Unsupported FeatureTable feature "${feature}" detected.`);
              }
            });
            const instanceMap = /* @__PURE__ */ new Map();
            const instances = [];
            model.scene.traverse((child) => {
              if (child.isMesh) {
                const { geometry, material } = child;
                const instancedMesh = new import_three4.InstancedMesh(geometry, material, INSTANCES_LENGTH);
                instancedMesh.position.copy(child.position);
                instancedMesh.rotation.copy(child.rotation);
                instancedMesh.scale.copy(child.scale);
                instances.push(instancedMesh);
                instanceMap.set(child, instancedMesh);
              }
            });
            const averageVector = new import_three4.Vector3();
            for (let i = 0; i < INSTANCES_LENGTH; i++) {
              averageVector.x += POSITION[i * 3 + 0] / INSTANCES_LENGTH;
              averageVector.y += POSITION[i * 3 + 1] / INSTANCES_LENGTH;
              averageVector.z += POSITION[i * 3 + 2] / INSTANCES_LENGTH;
            }
            instanceMap.forEach((instancedMesh, mesh) => {
              const parent = mesh.parent;
              if (parent) {
                parent.remove(mesh);
                parent.add(instancedMesh);
                instancedMesh.updateMatrixWorld();
                instancedMesh.position.copy(averageVector).applyMatrix4(instancedMesh.matrixWorld);
              }
            });
            for (let i = 0; i < INSTANCES_LENGTH; i++) {
              tempPos.set(
                POSITION[i * 3 + 0] - averageVector.x,
                POSITION[i * 3 + 1] - averageVector.y,
                POSITION[i * 3 + 2] - averageVector.z
              );
              if (NORMAL_UP) {
                tempUp.set(
                  NORMAL_UP[i * 3 + 0],
                  NORMAL_UP[i * 3 + 1],
                  NORMAL_UP[i * 3 + 2]
                );
                tempRight.set(
                  NORMAL_RIGHT[i * 3 + 0],
                  NORMAL_RIGHT[i * 3 + 1],
                  NORMAL_RIGHT[i * 3 + 2]
                );
                tempFwd.crossVectors(tempRight, tempUp).normalize();
                tempMat.makeBasis(
                  tempRight,
                  tempUp,
                  tempFwd
                );
                tempQuat.setFromRotationMatrix(tempMat);
              } else {
                tempQuat.set(0, 0, 0, 1);
              }
              if (SCALE) {
                tempSca.setScalar(SCALE[i]);
              } else if (SCALE_NON_UNIFORM) {
                tempSca.set(
                  SCALE_NON_UNIFORM[i * 3 + 0],
                  SCALE_NON_UNIFORM[i * 3 + 1],
                  SCALE_NON_UNIFORM[i * 3 + 2]
                );
              } else {
                tempSca.set(1, 1, 1);
              }
              tempMat.compose(tempPos, tempQuat, tempSca).multiply(adjustmentTransform);
              for (let j = 0, l = instances.length; j < l; j++) {
                const instance = instances[j];
                instance.setMatrixAt(i, tempMat);
              }
            }
            model.batchTable = batchTable;
            model.featureTable = featureTable;
            model.scene.batchTable = batchTable;
            model.scene.featureTable = featureTable;
            resolve(model);
          }, reject);
        });
      });
    }
  };

  // package/src/three/CMPTLoader.js
  var import_three5 = __require("three");

  // package/src/base/CMPTLoaderBase.js
  var CMPTLoaderBase = class extends LoaderBase {
    parse(buffer) {
      const dataView = new DataView(buffer);
      const magic = readMagicBytes(dataView);
      console.assert(magic === "cmpt", 'CMPTLoader: The magic bytes equal "cmpt".');
      const version = dataView.getUint32(4, true);
      console.assert(version === 1, 'CMPTLoader: The version listed in the header is "1".');
      const byteLength = dataView.getUint32(8, true);
      console.assert(byteLength === buffer.byteLength, "CMPTLoader: The contents buffer length listed in the header matches the file.");
      const tilesLength = dataView.getUint32(12, true);
      const tiles = [];
      let offset = 16;
      for (let i = 0; i < tilesLength; i++) {
        const tileView = new DataView(buffer, offset, 12);
        const tileMagic = readMagicBytes(tileView);
        const tileVersion = tileView.getUint32(4, true);
        const byteLength2 = tileView.getUint32(8, true);
        const tileBuffer = new Uint8Array(buffer, offset, byteLength2);
        tiles.push({
          type: tileMagic,
          buffer: tileBuffer,
          version: tileVersion
        });
        offset += byteLength2;
      }
      return {
        version,
        tiles
      };
    }
  };

  // package/src/three/CMPTLoader.js
  var CMPTLoader = class extends CMPTLoaderBase {
    constructor(manager = import_three5.DefaultLoadingManager) {
      super();
      this.manager = manager;
      this.adjustmentTransform = new import_three5.Matrix4();
    }
    parse(buffer) {
      const result = super.parse(buffer);
      const manager = this.manager;
      const adjustmentTransform = this.adjustmentTransform;
      const promises = [];
      for (const i in result.tiles) {
        const { type, buffer: buffer2 } = result.tiles[i];
        switch (type) {
          case "b3dm": {
            const slicedBuffer = buffer2.slice();
            const loader = new B3DMLoader(manager);
            loader.workingPath = this.workingPath;
            loader.fetchOptions = this.fetchOptions;
            loader.adjustmentTransform.copy(adjustmentTransform);
            const promise = loader.parse(slicedBuffer.buffer);
            promises.push(promise);
            break;
          }
          case "pnts": {
            const slicedBuffer = buffer2.slice();
            const loader = new PNTSLoader(manager);
            loader.workingPath = this.workingPath;
            loader.fetchOptions = this.fetchOptions;
            const promise = loader.parse(slicedBuffer.buffer);
            promises.push(promise);
            break;
          }
          case "i3dm": {
            const slicedBuffer = buffer2.slice();
            const loader = new I3DMLoader(manager);
            loader.workingPath = this.workingPath;
            loader.fetchOptions = this.fetchOptions;
            loader.adjustmentTransform.copy(adjustmentTransform);
            const promise = loader.parse(slicedBuffer.buffer);
            promises.push(promise);
            break;
          }
        }
      }
      return Promise.all(promises).then((results) => {
        const group = new import_three5.Group();
        results.forEach((result2) => {
          group.add(result2.scene);
        });
        return {
          tiles: results,
          scene: group
        };
      });
    }
  };

  // package/src/three/GLTFExtensionLoader.js
  var import_three6 = __require("three");
  var import_GLTFLoader3 = __require("three/examples/jsm/loaders/GLTFLoader.js");

  // package/src/three/GLTFCesiumRTCExtension.js
  var GLTFCesiumRTCExtension = class {
    constructor() {
      this.name = "CESIUM_RTC";
    }
    afterRoot(res) {
      if (res.parser.json.extensions && res.parser.json.extensions.CESIUM_RTC) {
        const { center } = res.parser.json.extensions.CESIUM_RTC;
        if (center) {
          res.scene.position.x += center[0];
          res.scene.position.y += center[1];
          res.scene.position.z += center[2];
        }
      }
    }
  };

  // package/src/three/GLTFExtensionLoader.js
  var GLTFExtensionLoader = class extends LoaderBase {
    constructor(manager = import_three6.DefaultLoadingManager) {
      super();
      this.manager = manager;
    }
    parse(buffer) {
      return new Promise((resolve, reject) => {
        const manager = this.manager;
        const fetchOptions = this.fetchOptions;
        let loader = manager.getHandler("path.gltf") || manager.getHandler("path.glb");
        if (!loader) {
          loader = new import_GLTFLoader3.GLTFLoader(manager);
          loader.register(() => new GLTFCesiumRTCExtension());
          if (fetchOptions.credentials === "include" && fetchOptions.mode === "cors") {
            loader.setCrossOrigin("use-credentials");
          }
          if ("credentials" in fetchOptions) {
            loader.setWithCredentials(fetchOptions.credentials === "include");
          }
          if (fetchOptions.headers) {
            loader.setRequestHeader(fetchOptions.headers);
          }
        }
        let resourcePath = loader.resourcePath || loader.path || this.workingPath;
        if (!/[\\/]$/.test(resourcePath) && resourcePath.length) {
          resourcePath += "/";
        }
        loader.parse(buffer, resourcePath, (model) => {
          resolve(model);
        }, reject);
      });
    }
  };

  // package/src/three/TilesGroup.js
  var import_three7 = __require("three");
  var tempMat2 = new import_three7.Matrix4();
  var TilesGroup = class extends import_three7.Group {
    constructor(tilesRenderer) {
      super();
      this.name = "TilesRenderer.TilesGroup";
      this.tilesRenderer = tilesRenderer;
    }
    raycast(raycaster, intersects) {
      if (this.tilesRenderer.optimizeRaycast) {
        this.tilesRenderer.raycast(raycaster, intersects);
      }
    }
    updateMatrixWorld(force) {
      if (this.matrixAutoUpdate) {
        this.updateMatrix();
      }
      if (this.matrixWorldNeedsUpdate || force) {
        if (this.parent === null) {
          tempMat2.copy(this.matrix);
        } else {
          tempMat2.multiplyMatrices(this.parent.matrixWorld, this.matrix);
        }
        this.matrixWorldNeedsUpdate = false;
        const elA = tempMat2.elements;
        const elB = this.matrixWorld.elements;
        let isDifferent = false;
        for (let i = 0; i < 16; i++) {
          const itemA = elA[i];
          const itemB = elB[i];
          const diff = Math.abs(itemA - itemB);
          if (diff > Number.EPSILON) {
            isDifferent = true;
            break;
          }
        }
        if (isDifferent) {
          this.matrixWorld.copy(tempMat2);
          const children = this.children;
          for (let i = 0, l = children.length; i < l; i++) {
            children[i].updateMatrixWorld();
          }
        }
      }
    }
  };

  // package/src/three/TilesRenderer.js
  var import_three16 = __require("three");

  // package/src/three/raycastTraverse.js
  var import_three8 = __require("three");
  var _mat = new import_three8.Matrix4();
  var _localRay = new import_three8.Ray();
  var _vec = new import_three8.Vector3();
  var _hitArray = [];
  function distanceSort(a, b) {
    return a.distance - b.distance;
  }
  function intersectTileScene(scene, raycaster, intersects) {
    scene.traverse((c) => {
      Object.getPrototypeOf(c).raycast.call(c, raycaster, intersects);
    });
  }
  function intersectTileSceneFirstHist(scene, raycaster) {
    intersectTileScene(scene, raycaster, _hitArray);
    _hitArray.sort(distanceSort);
    const hit = _hitArray[0] || null;
    _hitArray.length = 0;
    return hit;
  }
  function raycastTraverseFirstHit(renderer, tile, raycaster, localRay = null) {
    const { group, activeTiles } = renderer;
    renderer.ensureChildrenArePreprocessed(tile);
    if (localRay === null) {
      localRay = _localRay;
      _mat.copy(group.matrixWorld).invert();
      localRay.copy(raycaster.ray).applyMatrix4(_mat);
    }
    const array = [];
    const children = tile.children;
    for (let i = 0, l = children.length; i < l; i++) {
      const child = children[i];
      if (!child.__used) {
        continue;
      }
      const boundingVolume = child.cached.boundingVolume;
      if (boundingVolume.intersectRay(localRay, _vec) !== null) {
        _vec.applyMatrix4(group.matrixWorld);
        array.push({
          distance: _vec.distanceToSquared(raycaster.ray.origin),
          tile: child
        });
      }
    }
    array.sort(distanceSort);
    let bestHit = null;
    let bestHitDistSq = Infinity;
    if (activeTiles.has(tile)) {
      const hit = intersectTileSceneFirstHist(tile.cached.scene, raycaster);
      if (hit) {
        bestHit = hit;
        bestHitDistSq = hit.distance * hit.distance;
      }
    }
    for (let i = 0, l = array.length; i < l; i++) {
      const data = array[i];
      const boundingVolumeDistSq = data.distance;
      const tile2 = data.tile;
      if (boundingVolumeDistSq > bestHitDistSq) {
        break;
      }
      const hit = raycastTraverseFirstHit(renderer, tile2, raycaster, localRay);
      if (hit) {
        const hitDistSq = hit.distance * hit.distance;
        if (hitDistSq < bestHitDistSq) {
          bestHit = hit;
          bestHitDistSq = hitDistSq;
        }
      }
    }
    return bestHit;
  }
  function raycastTraverse(renderer, tile, raycaster, intersects, localRay = null) {
    const { group, activeTiles } = renderer;
    const { scene, boundingVolume } = tile.cached;
    renderer.ensureChildrenArePreprocessed(tile);
    if (localRay === null) {
      localRay = _localRay;
      _mat.copy(group.matrixWorld).invert();
      localRay.copy(raycaster.ray).applyMatrix4(_mat);
    }
    if (!tile.__used || !boundingVolume.intersectsRay(localRay)) {
      return;
    }
    if (activeTiles.has(tile)) {
      intersectTileScene(scene, raycaster, intersects);
    }
    const children = tile.children;
    for (let i = 0, l = children.length; i < l; i++) {
      raycastTraverse(renderer, children[i], raycaster, intersects, localRay);
    }
  }

  // package/src/three/math/TileBoundingVolume.js
  var import_three14 = __require("three");

  // package/src/three/math/OBB.js
  var import_three9 = __require("three");
  var _worldMin = new import_three9.Vector3();
  var _worldMax = new import_three9.Vector3();
  var _norm = new import_three9.Vector3();
  var OBB = class {
    constructor(box = new import_three9.Box3(), transform = new import_three9.Matrix4()) {
      this.box = box.clone();
      this.transform = transform.clone();
      this.inverseTransform = new import_three9.Matrix4();
      this.points = new Array(8).fill().map(() => new import_three9.Vector3());
      this.planes = new Array(6).fill().map(() => new import_three9.Plane());
    }
    update() {
      const { points, inverseTransform, transform, box } = this;
      inverseTransform.copy(transform).invert();
      const { min, max } = box;
      let index = 0;
      for (let x = -1; x <= 1; x += 2) {
        for (let y = -1; y <= 1; y += 2) {
          for (let z = -1; z <= 1; z += 2) {
            points[index].set(
              x < 0 ? min.x : max.x,
              y < 0 ? min.y : max.y,
              z < 0 ? min.z : max.z
            ).applyMatrix4(transform);
            index++;
          }
        }
      }
      this.updatePlanes();
    }
    updatePlanes() {
      _worldMin.copy(this.box.min).applyMatrix4(this.transform);
      _worldMax.copy(this.box.max).applyMatrix4(this.transform);
      _norm.set(0, 0, 1).transformDirection(this.transform);
      this.planes[0].setFromNormalAndCoplanarPoint(_norm, _worldMin);
      this.planes[1].setFromNormalAndCoplanarPoint(_norm, _worldMax).negate();
      _norm.set(0, 1, 0).transformDirection(this.transform);
      this.planes[2].setFromNormalAndCoplanarPoint(_norm, _worldMin);
      this.planes[3].setFromNormalAndCoplanarPoint(_norm, _worldMax).negate();
      _norm.set(1, 0, 0).transformDirection(this.transform);
      this.planes[4].setFromNormalAndCoplanarPoint(_norm, _worldMin);
      this.planes[5].setFromNormalAndCoplanarPoint(_norm, _worldMax).negate();
    }
    // based on three.js' Box3 "intersects frustum" function
    intersectsFrustum(frustum) {
      const { points } = this;
      const { planes } = frustum;
      for (let i = 0; i < 6; i++) {
        const plane = planes[i];
        let maxDistance = -Infinity;
        for (let j = 0; j < 8; j++) {
          const v = points[j];
          const dist = plane.distanceToPoint(v);
          maxDistance = maxDistance < dist ? dist : maxDistance;
        }
        if (maxDistance < 0) {
          return false;
        }
      }
      for (let i = 0; i < 6; i++) {
        const plane = this.planes[i];
        let maxDistance = -Infinity;
        for (let j = 0; j < 8; j++) {
          const v = frustum.points[j];
          const dist = plane.distanceToPoint(v);
          maxDistance = maxDistance < dist ? dist : maxDistance;
        }
        if (maxDistance < 0) {
          return false;
        }
      }
      return true;
    }
  };

  // package/src/three/math/EllipsoidRegion.js
  var import_three12 = __require("three");
  var import_three13 = __require("three");

  // package/src/three/math/Ellipsoid.js
  var import_three11 = __require("three");

  // package/src/three/math/GeoUtils.js
  var GeoUtils_exports = {};
  __export(GeoUtils_exports, {
    latitudeToSphericalPhi: () => latitudeToSphericalPhi,
    sphericalPhiToLatitude: () => sphericalPhiToLatitude,
    swapToGeoFrame: () => swapToGeoFrame,
    swapToThreeFrame: () => swapToThreeFrame,
    toLatLonString: () => toLatLonString
  });
  var import_three10 = __require("three");
  var _spherical = new import_three10.Spherical();
  var _vec2 = new import_three10.Vector3();
  var _geoResults = {};
  function swapToGeoFrame(target) {
    const { x, y, z } = target;
    target.x = z;
    target.y = x;
    target.z = y;
  }
  function swapToThreeFrame(target) {
    const { x, y, z } = target;
    target.z = x;
    target.x = y;
    target.y = z;
  }
  function sphericalPhiToLatitude(phi) {
    return -(phi - Math.PI / 2);
  }
  function latitudeToSphericalPhi(latitude) {
    return -latitude + Math.PI / 2;
  }
  function correctGeoCoordWrap(lat, lon, target = {}) {
    _spherical.theta = lon;
    _spherical.phi = latitudeToSphericalPhi(lat);
    _vec2.setFromSpherical(_spherical);
    _spherical.setFromVector3(_vec2);
    target.lat = sphericalPhiToLatitude(_spherical.phi);
    target.lon = _spherical.theta;
    return target;
  }
  function toHoursMinutesSecondsString(value, pos = "E", neg = "W") {
    const direction = value < 0 ? neg : pos;
    value = Math.abs(value);
    const hours = ~~value;
    const minDec = (value - hours) * 60;
    const minutes = ~~minDec;
    const secDec = (minDec - minutes) * 60;
    const seconds = ~~secDec;
    return `${hours}\xB0 ${minutes}' ${seconds}" ${direction}`;
  }
  function toLatLonString(lat, lon, decimalFormat = false) {
    const result = correctGeoCoordWrap(lat, lon, _geoResults);
    let latString, lonString;
    if (decimalFormat) {
      latString = `${(import_three10.MathUtils.RAD2DEG * result.lat).toFixed(4)}\xB0`;
      lonString = `${(import_three10.MathUtils.RAD2DEG * result.lon).toFixed(4)}\xB0`;
    } else {
      latString = toHoursMinutesSecondsString(import_three10.MathUtils.RAD2DEG * result.lat, "N", "S");
      lonString = toHoursMinutesSecondsString(import_three10.MathUtils.RAD2DEG * result.lon, "E", "W");
    }
    return `${latString} ${lonString}`;
  }

  // package/src/three/math/Ellipsoid.js
  var _spherical2 = new import_three11.Spherical();
  var _norm2 = new import_three11.Vector3();
  var _vec3 = new import_three11.Vector3();
  var _vec22 = new import_three11.Vector3();
  var _vec32 = new import_three11.Vector3();
  var _vecX = new import_three11.Vector3();
  var _vecY = new import_three11.Vector3();
  var _vecZ = new import_three11.Vector3();
  var _pos = new import_three11.Vector3();
  var EPSILON12 = 1e-12;
  var CENTER_EPS = 0.1;
  var Ellipsoid = class {
    constructor(x = 1, y = 1, z = 1) {
      this.radius = new import_three11.Vector3(x, y, z);
    }
    // returns a frame with Z indicating altitude
    // Y pointing north
    // X pointing east
    constructLatLonFrame(lat, lon, target) {
      this.getCartographicToPosition(lat, lon, 0, _pos);
      this.getCartographicToNormal(lat, lon, _vecZ);
      this.getNorthernTangent(lat, lon, _vecY);
      _vecX.crossVectors(_vecY, _vecZ);
      return target.makeBasis(_vecX, _vecY, _vecZ).setPosition(_pos);
    }
    getNorthernTangent(lat, lon, target, westTarget = _vec32) {
      let multiplier = 1;
      let latPrime = lat + 1e-7;
      if (lat > Math.PI / 4) {
        multiplier = -1;
        latPrime = lat - 1e-7;
      }
      const norm = this.getCartographicToNormal(lat, lon, _vec3).normalize();
      const normPrime = this.getCartographicToNormal(latPrime, lon, _vec22).normalize();
      westTarget.crossVectors(norm, normPrime).normalize().multiplyScalar(multiplier);
      return target.crossVectors(westTarget, norm).normalize();
    }
    getCartographicToPosition(lat, lon, height, target) {
      this.getCartographicToNormal(lat, lon, _norm2);
      const radius = this.radius;
      _vec3.copy(_norm2);
      _vec3.x *= radius.x ** 2;
      _vec3.y *= radius.y ** 2;
      _vec3.z *= radius.z ** 2;
      const gamma = Math.sqrt(_norm2.dot(_vec3));
      _vec3.divideScalar(gamma);
      return target.copy(_vec3).addScaledVector(_norm2, height);
    }
    getPositionToCartographic(pos, target) {
      this.getPositionToSurfacePoint(pos, _vec3);
      this.getPositionToNormal(pos, _norm2);
      const heightDelta = _vec22.subVectors(pos, _vec3);
      target.lon = Math.atan2(_norm2.y, _norm2.x);
      target.lat = Math.asin(_norm2.z);
      target.height = Math.sign(heightDelta.dot(pos)) * heightDelta.length();
      return target;
    }
    getCartographicToNormal(lat, lon, target) {
      _spherical2.set(1, latitudeToSphericalPhi(lat), lon);
      target.setFromSpherical(_spherical2).normalize();
      swapToGeoFrame(target);
      return target;
    }
    getPositionToNormal(pos, target) {
      const radius = this.radius;
      target.copy(pos);
      target.x /= radius.x ** 2;
      target.y /= radius.y ** 2;
      target.z /= radius.z ** 2;
      target.normalize();
      return target;
    }
    getPositionToSurfacePoint(pos, target) {
      const radius = this.radius;
      const invRadiusSqX = 1 / radius.x ** 2;
      const invRadiusSqY = 1 / radius.y ** 2;
      const invRadiusSqZ = 1 / radius.z ** 2;
      const x2 = pos.x * pos.x * invRadiusSqX;
      const y2 = pos.y * pos.y * invRadiusSqY;
      const z2 = pos.z * pos.z * invRadiusSqZ;
      const squaredNorm = x2 + y2 + z2;
      const ratio = Math.sqrt(1 / squaredNorm);
      const intersection = _vec3.copy(pos).multiplyScalar(ratio);
      if (squaredNorm < CENTER_EPS) {
        return !isFinite(ratio) ? null : target.copy(intersection);
      }
      const gradient = _vec22.set(
        intersection.x * invRadiusSqX * 2,
        intersection.y * invRadiusSqY * 2,
        intersection.z * invRadiusSqZ * 2
      );
      let lambda = (1 - ratio) * pos.length() / (0.5 * gradient.length());
      let correction = 0;
      let func, denominator;
      let xMultiplier, yMultiplier, zMultiplier;
      let xMultiplier2, yMultiplier2, zMultiplier2;
      let xMultiplier3, yMultiplier3, zMultiplier3;
      do {
        lambda -= correction;
        xMultiplier = 1 / (1 + lambda * invRadiusSqX);
        yMultiplier = 1 / (1 + lambda * invRadiusSqY);
        zMultiplier = 1 / (1 + lambda * invRadiusSqZ);
        xMultiplier2 = xMultiplier * xMultiplier;
        yMultiplier2 = yMultiplier * yMultiplier;
        zMultiplier2 = zMultiplier * zMultiplier;
        xMultiplier3 = xMultiplier2 * xMultiplier;
        yMultiplier3 = yMultiplier2 * yMultiplier;
        zMultiplier3 = zMultiplier2 * zMultiplier;
        func = x2 * xMultiplier2 + y2 * yMultiplier2 + z2 * zMultiplier2 - 1;
        denominator = x2 * xMultiplier3 * invRadiusSqX + y2 * yMultiplier3 * invRadiusSqY + z2 * zMultiplier3 * invRadiusSqZ;
        const derivative = -2 * denominator;
        correction = func / derivative;
      } while (Math.abs(func) > EPSILON12);
      return target.set(
        pos.x * xMultiplier,
        pos.y * yMultiplier,
        pos.z * zMultiplier
      );
    }
    calculateHorizonDistance(latitude, elevation) {
      const effectiveRadius = this.calculateEffectiveRadius(latitude);
      return Math.sqrt(2 * effectiveRadius * elevation + elevation ** 2);
    }
    calculateEffectiveRadius(latitude) {
      const semiMajorAxis = this.radius.x;
      const semiMinorAxis = this.radius.z;
      const eSquared = 1 - semiMinorAxis ** 2 / semiMajorAxis ** 2;
      const phi = latitude * import_three11.MathUtils.DEG2RAD;
      const sinPhiSquared = Math.sin(phi) ** 2;
      const N = semiMajorAxis / Math.sqrt(1 - eSquared * sinPhiSquared);
      return N;
    }
    getPositionElevation(pos) {
      this.getPositionToSurfacePoint(pos, _vec32);
      const elevation = _vec32.distanceTo(pos);
      return elevation;
    }
  };

  // package/src/three/math/EllipsoidRegion.js
  var PI = Math.PI;
  var HALF_PI = PI / 2;
  var _orthoX = new import_three13.Vector3();
  var _orthoY = new import_three13.Vector3();
  var _orthoZ = new import_three13.Vector3();
  var _invMatrix = new import_three12.Matrix4();
  var _poolIndex = 0;
  var _pointsPool = [];
  function getVector(usePool = false) {
    if (!usePool) {
      return new import_three13.Vector3();
    }
    if (!_pointsPool[_poolIndex]) {
      _pointsPool[_poolIndex] = new import_three13.Vector3();
    }
    _poolIndex++;
    return _pointsPool[_poolIndex - 1];
  }
  function resetPool() {
    _poolIndex = 0;
  }
  var EllipsoidRegion = class extends Ellipsoid {
    constructor(x, y, z, latStart = -HALF_PI, latEnd = HALF_PI, lonStart = 0, lonEnd = 2 * PI, heightStart = 0, heightEnd = 0) {
      super(x, y, z);
      this.latStart = latStart;
      this.latEnd = latEnd;
      this.lonStart = lonStart;
      this.lonEnd = lonEnd;
      this.heightStart = heightStart;
      this.heightEnd = heightEnd;
    }
    _getPoints(usePool = false) {
      const {
        latStart,
        latEnd,
        lonStart,
        lonEnd,
        heightStart,
        heightEnd
      } = this;
      const midLat = import_three12.MathUtils.mapLinear(0.5, 0, 1, latStart, latEnd);
      const midLon = import_three12.MathUtils.mapLinear(0.5, 0, 1, lonStart, lonEnd);
      const lonOffset = Math.floor(lonStart / HALF_PI) * HALF_PI;
      const latlon = [
        [-PI / 2, 0],
        [PI / 2, 0],
        [0, lonOffset],
        [0, lonOffset + PI / 2],
        [0, lonOffset + PI],
        [0, lonOffset + 3 * PI / 2],
        [latStart, lonEnd],
        [latEnd, lonEnd],
        [latStart, lonStart],
        [latEnd, lonStart],
        [0, lonStart],
        [0, lonEnd],
        [midLat, midLon],
        [latStart, midLon],
        [latEnd, midLon],
        [midLat, lonStart],
        [midLat, lonEnd]
      ];
      const target = [];
      const total = latlon.length;
      for (let z = 0; z <= 1; z++) {
        const height = import_three12.MathUtils.mapLinear(z, 0, 1, heightStart, heightEnd);
        for (let i = 0, l = total; i < l; i++) {
          const [lat, lon] = latlon[i];
          if (lat >= latStart && lat <= latEnd && lon >= lonStart && lon <= lonEnd) {
            const v = getVector(usePool);
            target.push(v);
            this.getCartographicToPosition(lat, lon, height, v);
          }
        }
      }
      return target;
    }
    getBoundingBox(box, matrix) {
      resetPool();
      const {
        latStart,
        latEnd,
        lonStart,
        lonEnd
      } = this;
      const latRange = latEnd - latStart;
      if (latRange < PI / 2) {
        const midLat = import_three12.MathUtils.mapLinear(0.5, 0, 1, latStart, latEnd);
        const midLon = import_three12.MathUtils.mapLinear(0.5, 0, 1, lonStart, lonEnd);
        this.getCartographicToNormal(midLat, midLon, _orthoZ);
        _orthoY.set(0, 0, 1);
        _orthoX.crossVectors(_orthoY, _orthoZ);
        _orthoY.crossVectors(_orthoX, _orthoZ);
        matrix.makeBasis(_orthoX, _orthoY, _orthoZ);
      } else {
        _orthoX.set(1, 0, 0);
        _orthoY.set(0, 1, 0);
        _orthoZ.set(0, 0, 1);
        matrix.makeBasis(_orthoX, _orthoY, _orthoZ);
      }
      _invMatrix.copy(matrix).invert();
      const points = this._getPoints(true);
      for (let i = 0, l = points.length; i < l; i++) {
        points[i].applyMatrix4(_invMatrix);
      }
      box.makeEmpty();
      box.setFromPoints(points);
    }
    getBoundingSphere(sphere, center) {
      resetPool();
      const points = this._getPoints(true);
      sphere.makeEmpty();
      sphere.setFromPoints(points, center);
    }
  };

  // package/src/three/math/TileBoundingVolume.js
  var _vecX2 = new import_three14.Vector3();
  var _vecY2 = new import_three14.Vector3();
  var _vecZ2 = new import_three14.Vector3();
  var _vec4 = new import_three14.Vector3();
  var _sphereVec = new import_three14.Vector3();
  var _obbVec = new import_three14.Vector3();
  var _ray = new import_three14.Ray();
  var TileBoundingVolume = class {
    constructor() {
      this.sphere = null;
      this.obb = null;
      this.region = null;
      this.regionObb = null;
    }
    intersectsRay(ray) {
      const sphere = this.sphere;
      const obb = this.obb || this.regionObb;
      if (sphere && !ray.intersectsSphere(sphere)) {
        return false;
      }
      if (obb) {
        _ray.copy(ray).applyMatrix4(obb.inverseTransform);
        if (!_ray.intersectsBox(obb.box)) {
          return false;
        }
      }
      return true;
    }
    intersectRay(ray, target = null) {
      const sphere = this.sphere;
      const obb = this.obb || this.regionObb;
      let sphereDistSq = -Infinity;
      let obbDistSq = -Infinity;
      if (sphere) {
        if (ray.intersectSphere(sphere, _sphereVec)) {
          sphereDistSq = sphere.containsPoint(ray.origin) ? 0 : ray.origin.distanceToSquared(_sphereVec);
        }
      }
      if (obb) {
        _ray.copy(ray).applyMatrix4(obb.inverseTransform);
        if (_ray.intersectBox(obb.box, _obbVec)) {
          obbDistSq = obb.box.containsPoint(_ray.origin) ? 0 : _ray.origin.distanceToSquared(_obbVec);
        }
      }
      const furthestDist = Math.max(sphereDistSq, obbDistSq);
      if (furthestDist === -Infinity) {
        return null;
      }
      ray.at(Math.sqrt(furthestDist), target);
      return target;
    }
    distanceToPoint(point) {
      const sphere = this.sphere;
      const obb = this.obb || this.regionObb;
      let sphereDistance = -Infinity;
      let obbDistance = -Infinity;
      if (sphere) {
        sphereDistance = Math.max(sphere.distanceToPoint(point), 0);
      }
      if (obb) {
        _vec4.copy(point).applyMatrix4(obb.inverseTransform);
        obbDistance = obb.box.distanceToPoint(_vec4);
      }
      return sphereDistance > obbDistance ? sphereDistance : obbDistance;
    }
    intersectsFrustum(frustum) {
      const obb = this.obb || this.regionObb;
      const sphere = this.sphere;
      if (sphere && !frustum.intersectsSphere(sphere)) {
        return false;
      }
      if (obb && !obb.intersectsFrustum(frustum)) {
        return false;
      }
      return Boolean(sphere || obb);
    }
    getOBB(targetBox, targetMatrix) {
      const obb = this.obb || this.regionObb;
      if (obb) {
        targetBox.copy(obb.box);
        targetMatrix.copy(obb.transform);
      } else {
        this.getAABB(targetBox);
        targetMatrix.identity();
      }
    }
    getAABB(target) {
      if (this.sphere) {
        this.sphere.getBoundingBox(target);
      } else {
        const obb = this.obb || this.regionObb;
        target.copy(obb.box).applyMatrix4(obb.transform);
      }
    }
    getSphere(target) {
      if (this.sphere) {
        target.copy(this.sphere);
      } else if (this.region) {
        this.region.getBoundingSphere(target);
      } else {
        const obb = this.obb || this.regionObb;
        obb.box.getBoundingSphere(target);
        target.applyMatrix4(obb.transform);
      }
    }
    setObbData(data, transform) {
      const obb = new OBB();
      _vecX2.set(data[3], data[4], data[5]);
      _vecY2.set(data[6], data[7], data[8]);
      _vecZ2.set(data[9], data[10], data[11]);
      const scaleX = _vecX2.length();
      const scaleY = _vecY2.length();
      const scaleZ = _vecZ2.length();
      _vecX2.normalize();
      _vecY2.normalize();
      _vecZ2.normalize();
      if (scaleX === 0) {
        _vecX2.crossVectors(_vecY2, _vecZ2);
      }
      if (scaleY === 0) {
        _vecY2.crossVectors(_vecX2, _vecZ2);
      }
      if (scaleZ === 0) {
        _vecZ2.crossVectors(_vecX2, _vecY2);
      }
      obb.transform.set(
        _vecX2.x,
        _vecY2.x,
        _vecZ2.x,
        data[0],
        _vecX2.y,
        _vecY2.y,
        _vecZ2.y,
        data[1],
        _vecX2.z,
        _vecY2.z,
        _vecZ2.z,
        data[2],
        0,
        0,
        0,
        1
      ).premultiply(transform);
      obb.box.min.set(-scaleX, -scaleY, -scaleZ);
      obb.box.max.set(scaleX, scaleY, scaleZ);
      obb.update();
      this.obb = obb;
    }
    setSphereData(x, y, z, radius, transform) {
      const sphere = new import_three14.Sphere();
      sphere.center.set(x, y, z);
      sphere.radius = radius;
      sphere.applyMatrix4(transform);
      this.sphere = sphere;
    }
    setRegionData(west, south, east, north, minHeight, maxHeight) {
      const region = new EllipsoidRegion(
        WGS84_RADIUS,
        WGS84_RADIUS,
        WGS84_HEIGHT,
        south,
        north,
        west,
        east,
        minHeight,
        maxHeight
      );
      const obb = new OBB();
      region.getBoundingBox(obb.box, obb.transform);
      obb.update();
      this.region = region;
      this.regionObb = obb;
    }
  };

  // package/src/three/math/ExtendedFrustum.js
  var import_three15 = __require("three");
  var _mat3 = new import_three15.Matrix3();
  function findIntersectionPoint(plane1, plane2, plane3, target) {
    const A = _mat3.set(
      plane1.normal.x,
      plane1.normal.y,
      plane1.normal.z,
      plane2.normal.x,
      plane2.normal.y,
      plane2.normal.z,
      plane3.normal.x,
      plane3.normal.y,
      plane3.normal.z
    );
    target.set(-plane1.constant, -plane2.constant, -plane3.constant);
    target.applyMatrix3(A.invert());
    return target;
  }
  var ExtendedFrustum = class extends import_three15.Frustum {
    constructor() {
      super();
      this.points = Array(8).fill().map(() => new import_three15.Vector3());
    }
    setFromProjectionMatrix(m, coordinateSystem) {
      super.setFromProjectionMatrix(m, coordinateSystem);
      this.calculateFrustumPoints();
    }
    calculateFrustumPoints() {
      const { planes, points } = this;
      const planeIntersections = [
        [planes[0], planes[3], planes[4]],
        // Near top left
        [planes[1], planes[3], planes[4]],
        // Near top right
        [planes[0], planes[2], planes[4]],
        // Near bottom left
        [planes[1], planes[2], planes[4]],
        // Near bottom right
        [planes[0], planes[3], planes[5]],
        // Far top left
        [planes[1], planes[3], planes[5]],
        // Far top right
        [planes[0], planes[2], planes[5]],
        // Far bottom left
        [planes[1], planes[2], planes[5]]
        // Far bottom right
      ];
      planeIntersections.forEach((planes2, index) => {
        findIntersectionPoint(planes2[0], planes2[1], planes2[2], points[index]);
      });
    }
  };

  // package/src/three/TilesRenderer.js
  var INITIAL_FRUSTUM_CULLED = /* @__PURE__ */ Symbol("INITIAL_FRUSTUM_CULLED");
  var tempMat3 = new import_three16.Matrix4();
  var tempMat22 = new import_three16.Matrix4();
  var tempVector = new import_three16.Vector3();
  var X_AXIS = new import_three16.Vector3(1, 0, 0);
  var Y_AXIS = new import_three16.Vector3(0, 1, 0);
  function updateFrustumCulled(object, toInitialValue) {
    object.traverse((c) => {
      c.frustumCulled = c[INITIAL_FRUSTUM_CULLED] && toInitialValue;
    });
  }
  var TilesRenderer = class extends TilesRendererBase {
    get autoDisableRendererCulling() {
      return this._autoDisableRendererCulling;
    }
    set autoDisableRendererCulling(value) {
      if (this._autoDisableRendererCulling !== value) {
        super._autoDisableRendererCulling = value;
        this.forEachLoadedModel((scene) => {
          updateFrustumCulled(scene, !value);
        });
      }
    }
    constructor(...args) {
      super(...args);
      this.group = new TilesGroup(this);
      this.cameras = [];
      this.cameraMap = /* @__PURE__ */ new Map();
      this.cameraInfo = [];
      this.activeTiles = /* @__PURE__ */ new Set();
      this.visibleTiles = /* @__PURE__ */ new Set();
      this.optimizeRaycast = true;
      this._autoDisableRendererCulling = true;
      this._eventDispatcher = new import_three16.EventDispatcher();
      this.onLoadTileSet = null;
      this.onLoadModel = null;
      this.onDisposeModel = null;
      this.onTileVisibilityChange = null;
      const manager = new import_three16.LoadingManager();
      manager.setURLModifier((url) => {
        if (this.preprocessURL) {
          return this.preprocessURL(url);
        } else {
          return url;
        }
      });
      this.manager = manager;
      const tilesRenderer = this;
      this._overridenRaycast = function(raycaster, intersects) {
        if (!tilesRenderer.optimizeRaycast) {
          Object.getPrototypeOf(this).raycast.call(this, raycaster, intersects);
        }
      };
    }
    addEventListener(...args) {
      this._eventDispatcher.addEventListener(...args);
    }
    hasEventListener(...args) {
      this._eventDispatcher.hasEventListener(...args);
    }
    removeEventListener(...args) {
      this._eventDispatcher.removeEventListener(...args);
    }
    dispatchEvent(...args) {
      this._eventDispatcher.dispatchEvent(...args);
    }
    /* Public API */
    getBounds(...args) {
      console.warn("TilesRenderer: getBounds has been renamed to getBoundingBox.");
      return this.getBoundingBox(...args);
    }
    getOrientedBounds(...args) {
      console.warn("TilesRenderer: getOrientedBounds has been renamed to getOrientedBoundingBox.");
      return this.getOrientedBoundingBox(...args);
    }
    getBoundingBox(target) {
      if (!this.root) {
        return false;
      }
      const boundingVolume = this.root.cached.boundingVolume;
      if (boundingVolume) {
        boundingVolume.getAABB(target);
        return true;
      } else {
        return true;
      }
    }
    getOrientedBoundingBox(targetBox, targetMatrix) {
      if (!this.root) {
        return false;
      }
      const boundingVolume = this.root.cached.boundingVolume;
      if (boundingVolume) {
        boundingVolume.getOBB(targetBox, targetMatrix);
        return true;
      } else {
        return true;
      }
    }
    getBoundingSphere(target) {
      if (!this.root) {
        return false;
      }
      const boundingVolume = this.root.cached.boundingVolume;
      if (boundingVolume) {
        boundingVolume.getSphere(target);
        return true;
      } else {
        return false;
      }
    }
    forEachLoadedModel(callback) {
      this.traverse((tile) => {
        const scene = tile.cached.scene;
        if (scene) {
          callback(scene, tile);
        }
      });
    }
    raycast(raycaster, intersects) {
      if (!this.root) {
        return;
      }
      if (raycaster.firstHitOnly) {
        const hit = raycastTraverseFirstHit(this, this.root, raycaster);
        if (hit) {
          intersects.push(hit);
        }
      } else {
        raycastTraverse(this, this.root, raycaster, intersects);
      }
    }
    hasCamera(camera) {
      return this.cameraMap.has(camera);
    }
    setCamera(camera) {
      const cameras = this.cameras;
      const cameraMap = this.cameraMap;
      if (!cameraMap.has(camera)) {
        cameraMap.set(camera, new import_three16.Vector2());
        cameras.push(camera);
        return true;
      }
      return false;
    }
    setResolution(camera, xOrVec, y) {
      const cameraMap = this.cameraMap;
      if (!cameraMap.has(camera)) {
        return false;
      }
      if (xOrVec instanceof import_three16.Vector2) {
        cameraMap.get(camera).copy(xOrVec);
      } else {
        cameraMap.get(camera).set(xOrVec, y);
      }
      return true;
    }
    setResolutionFromRenderer(camera, renderer) {
      const cameraMap = this.cameraMap;
      if (!cameraMap.has(camera)) {
        return false;
      }
      const resolution = cameraMap.get(camera);
      renderer.getSize(resolution);
      resolution.multiplyScalar(renderer.getPixelRatio());
      return true;
    }
    deleteCamera(camera) {
      const cameras = this.cameras;
      const cameraMap = this.cameraMap;
      if (cameraMap.has(camera)) {
        const index = cameras.indexOf(camera);
        cameras.splice(index, 1);
        cameraMap.delete(camera);
        return true;
      }
      return false;
    }
    /* Overriden */
    fetchTileSet(url, ...rest) {
      const pr = super.fetchTileSet(url, ...rest);
      pr.then((json) => {
        Promise.resolve().then(() => {
          this.dispatchEvent({
            type: "load-tile-set",
            tileSet: json,
            url
          });
          if (this.onLoadTileSet) {
            this.onLoadTileSet(json, url);
          }
        });
      });
      return pr;
    }
    update() {
      const group = this.group;
      const cameras = this.cameras;
      const cameraMap = this.cameraMap;
      const cameraInfo = this.cameraInfo;
      if (cameras.length === 0) {
        console.warn("TilesRenderer: no cameras defined. Cannot update 3d tiles.");
        return;
      }
      while (cameraInfo.length > cameras.length) {
        cameraInfo.pop();
      }
      while (cameraInfo.length < cameras.length) {
        cameraInfo.push({
          frustum: new ExtendedFrustum(),
          isOrthographic: false,
          sseDenominator: -1,
          // used if isOrthographic:false
          position: new import_three16.Vector3(),
          invScale: -1,
          pixelSize: 0
          // used if isOrthographic:true
        });
      }
      tempMat22.copy(group.matrixWorld).invert();
      tempVector.setFromMatrixScale(tempMat22);
      const invScale = tempVector.x;
      if (Math.abs(Math.max(tempVector.x - tempVector.y, tempVector.x - tempVector.z)) > 1e-6) {
        console.warn("ThreeTilesRenderer : Non uniform scale used for tile which may cause issues when calculating screen space error.");
      }
      for (let i = 0, l = cameraInfo.length; i < l; i++) {
        const camera = cameras[i];
        const info = cameraInfo[i];
        const frustum = info.frustum;
        const position = info.position;
        const resolution = cameraMap.get(camera);
        if (resolution.width === 0 || resolution.height === 0) {
          console.warn("TilesRenderer: resolution for camera error calculation is not set.");
        }
        const projection = camera.projectionMatrix.elements;
        info.isOrthographic = projection[15] === 1;
        if (info.isOrthographic) {
          const w = 2 / projection[0];
          const h = 2 / projection[5];
          info.pixelSize = Math.max(h / resolution.height, w / resolution.width);
        } else {
          info.sseDenominator = 2 / projection[5] / resolution.height;
        }
        info.invScale = invScale;
        tempMat3.copy(group.matrixWorld);
        tempMat3.premultiply(camera.matrixWorldInverse);
        tempMat3.premultiply(camera.projectionMatrix);
        frustum.setFromProjectionMatrix(tempMat3);
        position.set(0, 0, 0);
        position.applyMatrix4(camera.matrixWorld);
        position.applyMatrix4(tempMat22);
      }
      super.update();
    }
    preprocessNode(tile, tileSetDir, parentTile = null) {
      super.preprocessNode(tile, tileSetDir, parentTile);
      const transform = new import_three16.Matrix4();
      if (tile.transform) {
        const transformArr = tile.transform;
        for (let i = 0; i < 16; i++) {
          transform.elements[i] = transformArr[i];
        }
      } else {
        transform.identity();
      }
      if (parentTile) {
        transform.premultiply(parentTile.cached.transform);
      }
      const transformInverse = new import_three16.Matrix4().copy(transform).invert();
      const boundingVolume = new TileBoundingVolume();
      if ("sphere" in tile.boundingVolume) {
        boundingVolume.setSphereData(...tile.boundingVolume.sphere, transform);
      }
      if ("box" in tile.boundingVolume) {
        boundingVolume.setObbData(tile.boundingVolume.box, transform);
      }
      if ("region" in tile.boundingVolume) {
        boundingVolume.setRegionData(...tile.boundingVolume.region);
      }
      tile.cached = {
        loadIndex: 0,
        transform,
        transformInverse,
        active: false,
        inFrustum: [],
        boundingVolume,
        scene: null,
        geometry: null,
        material: null
      };
    }
    parseTile(buffer, tile, extension) {
      tile._loadIndex = tile._loadIndex || 0;
      tile._loadIndex++;
      const uri = tile.content.uri;
      const uriSplits = uri.split(/[\\\/]/g);
      uriSplits.pop();
      const workingPath = uriSplits.join("/");
      const fetchOptions = this.fetchOptions;
      const manager = this.manager;
      const loadIndex = tile._loadIndex;
      let promise = null;
      const upAxis = this.rootTileSet.asset && this.rootTileSet.asset.gltfUpAxis || "y";
      const cached = tile.cached;
      const cachedTransform = cached.transform;
      const upAdjustment = new import_three16.Matrix4();
      switch (upAxis.toLowerCase()) {
        case "x":
          upAdjustment.makeRotationAxis(Y_AXIS, -Math.PI / 2);
          break;
        case "y":
          upAdjustment.makeRotationAxis(X_AXIS, Math.PI / 2);
          break;
        case "z":
          upAdjustment.identity();
          break;
      }
      const fileType = (readMagicBytes(buffer) || extension).toLowerCase();
      switch (fileType) {
        case "b3dm": {
          const loader2 = new B3DMLoader(manager);
          loader2.workingPath = workingPath;
          loader2.fetchOptions = fetchOptions;
          loader2.adjustmentTransform.copy(upAdjustment);
          promise = loader2.parse(buffer);
          break;
        }
        case "pnts": {
          const loader2 = new PNTSLoader(manager);
          loader2.workingPath = workingPath;
          loader2.fetchOptions = fetchOptions;
          promise = loader2.parse(buffer);
          break;
        }
        case "i3dm": {
          const loader2 = new I3DMLoader(manager);
          loader2.workingPath = workingPath;
          loader2.fetchOptions = fetchOptions;
          loader2.adjustmentTransform.copy(upAdjustment);
          promise = loader2.parse(buffer);
          break;
        }
        case "cmpt": {
          const loader2 = new CMPTLoader(manager);
          loader2.workingPath = workingPath;
          loader2.fetchOptions = fetchOptions;
          loader2.adjustmentTransform.copy(upAdjustment);
          promise = loader2.parse(buffer).then((res) => res.scene);
          break;
        }
        // 3DTILES_content_gltf
        case "gltf":
        case "glb":
          const loader = new GLTFExtensionLoader(manager);
          loader.workingPath = workingPath;
          loader.fetchOptions = fetchOptions;
          promise = loader.parse(buffer);
          break;
        default:
          console.warn(`TilesRenderer: Content type "${fileType}" not supported.`);
          promise = Promise.resolve(null);
          break;
      }
      return promise.then((result) => {
        let scene;
        let metadata;
        if (result.isObject3D) {
          scene = result;
          metadata = null;
        } else {
          scene = result.scene;
          metadata = result;
        }
        if (tile._loadIndex !== loadIndex) {
          return;
        }
        scene.updateMatrix();
        if (fileType === "glb" || fileType === "gltf") {
          scene.matrix.multiply(upAdjustment);
        }
        scene.matrix.premultiply(cachedTransform);
        scene.matrix.decompose(scene.position, scene.quaternion, scene.scale);
        scene.traverse((c) => {
          c[INITIAL_FRUSTUM_CULLED] = c.frustumCulled;
        });
        updateFrustumCulled(scene, !this.autoDisableRendererCulling);
        scene.traverse((c) => {
          c.raycast = this._overridenRaycast;
        });
        const materials = [];
        const geometry = [];
        const textures = [];
        scene.traverse((c) => {
          if (c.geometry) {
            geometry.push(c.geometry);
          }
          if (c.material) {
            const material = c.material;
            materials.push(c.material);
            for (const key in material) {
              const value = material[key];
              if (value && value.isTexture) {
                textures.push(value);
              }
            }
          }
        });
        cached.materials = materials;
        cached.geometry = geometry;
        cached.textures = textures;
        cached.scene = scene;
        cached.metadata = metadata;
        this.dispatchEvent({
          type: "load-model",
          scene,
          tile
        });
        if (this.onLoadModel) {
          this.onLoadModel(scene, tile);
        }
      });
    }
    disposeTile(tile) {
      const cached = tile.cached;
      if (cached.scene) {
        const materials = cached.materials;
        const geometry = cached.geometry;
        const textures = cached.textures;
        const parent = cached.scene.parent;
        for (let i = 0, l = geometry.length; i < l; i++) {
          geometry[i].dispose();
        }
        for (let i = 0, l = materials.length; i < l; i++) {
          materials[i].dispose();
        }
        for (let i = 0, l = textures.length; i < l; i++) {
          const texture = textures[i];
          if (texture.image instanceof ImageBitmap) {
            texture.image.close();
          }
          texture.dispose();
        }
        if (parent) {
          parent.remove(cached.scene);
        }
        this.dispatchEvent({
          type: "dispose-model",
          scene: cached.scene,
          tile
        });
        if (this.onDisposeModel) {
          this.onDisposeModel(cached.scene, tile);
        }
        cached.scene = null;
        cached.materials = null;
        cached.textures = null;
        cached.geometry = null;
        cached.metadata = null;
      }
      this.activeTiles.delete(tile);
      this.visibleTiles.delete(tile);
      tile._loadIndex++;
    }
    setTileVisible(tile, visible) {
      const scene = tile.cached.scene;
      const visibleTiles = this.visibleTiles;
      const group = this.group;
      if (visible) {
        group.add(scene);
        visibleTiles.add(tile);
        scene.updateMatrixWorld(true);
      } else {
        group.remove(scene);
        visibleTiles.delete(tile);
      }
      this.dispatchEvent({
        type: "tile-visibility-change",
        scene,
        tile,
        visible
      });
      if (this.onTileVisibilityChange) {
        this.onTileVisibilityChange(scene, tile, visible);
      }
    }
    setTileActive(tile, active) {
      const activeTiles = this.activeTiles;
      if (active) {
        activeTiles.add(tile);
      } else {
        activeTiles.delete(tile);
      }
    }
    calculateError(tile) {
      const cached = tile.cached;
      const inFrustum = cached.inFrustum;
      const cameras = this.cameras;
      const cameraInfo = this.cameraInfo;
      const boundingVolume = cached.boundingVolume;
      let maxError = -Infinity;
      let minDistance = Infinity;
      for (let i = 0, l = cameras.length; i < l; i++) {
        if (!inFrustum[i]) {
          continue;
        }
        const info = cameraInfo[i];
        const invScale = info.invScale;
        let error;
        if (info.isOrthographic) {
          const pixelSize = info.pixelSize;
          error = tile.geometricError / (pixelSize * invScale);
        } else {
          const distance = boundingVolume.distanceToPoint(info.position);
          const scaledDistance = distance * invScale;
          const sseDenominator = info.sseDenominator;
          error = tile.geometricError / (scaledDistance * sseDenominator);
          minDistance = Math.min(minDistance, scaledDistance);
        }
        maxError = Math.max(maxError, error);
      }
      tile.__distanceFromCamera = minDistance;
      tile.__error = maxError;
    }
    tileInView(tile) {
      const cached = tile.cached;
      const boundingVolume = cached.boundingVolume;
      const inFrustum = cached.inFrustum;
      const cameraInfo = this.cameraInfo;
      let inView = false;
      for (let i = 0, l = cameraInfo.length; i < l; i++) {
        const frustum = cameraInfo[i].frustum;
        if (boundingVolume.intersectsFrustum(frustum)) {
          inView = true;
          inFrustum[i] = true;
        } else {
          inFrustum[i] = false;
        }
      }
      return inView;
    }
  };

  // package/src/three/objects/SphereHelper.js
  var import_three17 = __require("three");
  var _vector = new import_three17.Vector3();
  var axes = ["x", "y", "z"];
  var SphereHelper = class extends import_three17.LineSegments {
    constructor(sphere, color = 16776960, angleSteps = 40) {
      const geometry = new import_three17.BufferGeometry();
      const positions = [];
      for (let i = 0; i < 3; i++) {
        const axis1 = axes[i];
        const axis2 = axes[(i + 1) % 3];
        _vector.set(0, 0, 0);
        for (let a = 0; a < angleSteps; a++) {
          let angle;
          angle = 2 * Math.PI * a / (angleSteps - 1);
          _vector[axis1] = Math.sin(angle);
          _vector[axis2] = Math.cos(angle);
          positions.push(_vector.x, _vector.y, _vector.z);
          angle = 2 * Math.PI * (a + 1) / (angleSteps - 1);
          _vector[axis1] = Math.sin(angle);
          _vector[axis2] = Math.cos(angle);
          positions.push(_vector.x, _vector.y, _vector.z);
        }
      }
      geometry.setAttribute("position", new import_three17.BufferAttribute(new Float32Array(positions), 3));
      geometry.computeBoundingSphere();
      super(geometry, new import_three17.LineBasicMaterial({ color, toneMapped: false }));
      this.sphere = sphere;
      this.type = "SphereHelper";
    }
    updateMatrixWorld(force) {
      const sphere = this.sphere;
      this.position.copy(sphere.center);
      this.scale.setScalar(sphere.radius);
      super.updateMatrixWorld(force);
    }
  };

  // package/src/three/objects/EllipsoidRegionHelper.js
  var import_three18 = __require("three");
  var import_three19 = __require("three");
  var _norm3 = new import_three18.Vector3();
  var _norm22 = new import_three18.Vector3();
  var _pos2 = new import_three18.Vector3();
  var _vec1 = new import_three18.Vector3();
  var _vec23 = new import_three18.Vector3();
  function toGroupGeometry(geometry) {
    geometry = geometry.toNonIndexed();
    const { groups } = geometry;
    const { position, normal } = geometry.attributes;
    const newNorm = [];
    const newPos = [];
    for (const group of groups) {
      const { start, count } = group;
      for (let i = start, l = start + count; i < l; i++) {
        _vec1.fromBufferAttribute(position, i);
        _vec23.fromBufferAttribute(normal, i);
        newPos.push(..._vec1);
        newNorm.push(..._vec23);
      }
    }
    const newGeometry = new import_three18.BufferGeometry();
    newGeometry.setAttribute("position", new import_three19.BufferAttribute(new Float32Array(newPos), 3));
    newGeometry.setAttribute("normal", new import_three19.BufferAttribute(new Float32Array(newNorm), 3));
    return newGeometry;
  }
  function getRegionGeometry(ellipsoidRegion) {
    const {
      latStart = -Math.PI / 2,
      latEnd = Math.PI / 2,
      lonStart = 0,
      lonEnd = 2 * Math.PI,
      heightStart = 0,
      heightEnd = 0
    } = ellipsoidRegion;
    const geometry = new import_three18.BoxGeometry(1, 1, 1, 32, 32);
    const { normal, position } = geometry.attributes;
    const refPosition = position.clone();
    for (let i = 0, l = position.count; i < l; i++) {
      _pos2.fromBufferAttribute(position, i);
      const lat = import_three18.MathUtils.mapLinear(_pos2.x, -0.5, 0.5, latStart, latEnd);
      const lon = import_three18.MathUtils.mapLinear(_pos2.y, -0.5, 0.5, lonStart, lonEnd);
      let height = heightStart;
      ellipsoidRegion.getCartographicToNormal(lat, lon, _norm3);
      if (_pos2.z < 0) {
        height = heightEnd;
      }
      ellipsoidRegion.getCartographicToPosition(lat, lon, height, _pos2);
      position.setXYZ(i, ..._pos2);
    }
    geometry.computeVertexNormals();
    for (let i = 0, l = refPosition.count; i < l; i++) {
      _pos2.fromBufferAttribute(refPosition, i);
      const lat = import_three18.MathUtils.mapLinear(_pos2.x, -0.5, 0.5, latStart, latEnd);
      const lon = import_three18.MathUtils.mapLinear(_pos2.y, -0.5, 0.5, lonStart, lonEnd);
      _norm3.fromBufferAttribute(normal, i);
      ellipsoidRegion.getCartographicToNormal(lat, lon, _norm22);
      if (Math.abs(_norm3.dot(_norm22)) > 0.1) {
        if (_pos2.z > 0) {
          _norm22.multiplyScalar(-1);
        }
        normal.setXYZ(i, ..._norm22);
      }
    }
    return geometry;
  }
  var EllipsoidRegionLineHelper = class extends import_three18.LineSegments {
    constructor(ellipsoidRegion = new EllipsoidRegion(), color = 16776960) {
      super();
      this.ellipsoidRegion = ellipsoidRegion;
      this.material.color.set(color);
      this.update();
    }
    update() {
      const geometry = getRegionGeometry(this.ellipsoidRegion);
      this.geometry.dispose();
      this.geometry = new import_three18.EdgesGeometry(geometry, 80);
    }
    dispose() {
      this.geometry.dispose();
      this.material.dispose();
    }
  };
  var EllipsoidRegionHelper = class extends import_three18.Mesh {
    constructor(ellipsoidRegion = new EllipsoidRegion(), color = 16776960) {
      super();
      this.ellipsoidRegion = ellipsoidRegion;
      this.material.color.set(color);
      this.update();
    }
    update() {
      this.geometry.dispose();
      const geometry = getRegionGeometry(this.ellipsoidRegion);
      const { lonStart, lonEnd } = this;
      if (lonEnd - lonStart >= 2 * Math.PI) {
        geometry.groups.splice(2, 2);
        this.geometry = toGroupGeometry(geometry);
      } else {
        this.geometry = geometry;
      }
    }
    dispose() {
      this.geometry.dispose();
      this.material.dispose();
    }
  };

  // package/src/three/DebugTilesRenderer.js
  var ORIGINAL_MATERIAL = /* @__PURE__ */ Symbol("ORIGINAL_MATERIAL");
  var HAS_RANDOM_COLOR = /* @__PURE__ */ Symbol("HAS_RANDOM_COLOR");
  var HAS_RANDOM_NODE_COLOR = /* @__PURE__ */ Symbol("HAS_RANDOM_NODE_COLOR");
  var LOAD_TIME = /* @__PURE__ */ Symbol("LOAD_TIME");
  function emptyRaycast() {
  }
  var NONE = 0;
  var SCREEN_ERROR = 1;
  var GEOMETRIC_ERROR = 2;
  var DISTANCE = 3;
  var DEPTH = 4;
  var RELATIVE_DEPTH = 5;
  var IS_LEAF = 6;
  var RANDOM_COLOR = 7;
  var RANDOM_NODE_COLOR = 8;
  var CUSTOM_COLOR = 9;
  var LOAD_ORDER = 10;
  var _sphere = new import_three20.Sphere();
  var DebugTilesRenderer = class extends TilesRenderer {
    constructor(...args) {
      super(...args);
      const tilesGroup = this.group;
      const boxGroup = new import_three20.Group();
      boxGroup.name = "DebugTilesRenderer.boxGroup";
      tilesGroup.add(boxGroup);
      const sphereGroup = new import_three20.Group();
      sphereGroup.name = "DebugTilesRenderer.sphereGroup";
      tilesGroup.add(sphereGroup);
      const regionGroup = new import_three20.Group();
      regionGroup.name = "DebugTilesRenderer.regionGroup";
      tilesGroup.add(regionGroup);
      this.displayBoxBounds = false;
      this.displaySphereBounds = false;
      this.displayRegionBounds = false;
      this.colorMode = NONE;
      this.customColorCallback = null;
      this.boxGroup = boxGroup;
      this.sphereGroup = sphereGroup;
      this.regionGroup = regionGroup;
      this.maxDebugDepth = -1;
      this.maxDebugDistance = -1;
      this.maxDebugError = -1;
      this.getDebugColor = (value, target) => {
        target.setRGB(value, value, value);
      };
      this.extremeDebugDepth = -1;
      this.extremeDebugError = -1;
    }
    initExtremes() {
      let maxDepth = -1;
      this.traverse((tile) => {
        maxDepth = Math.max(maxDepth, tile.__depth);
      });
      let maxError = -1;
      this.traverse((tile) => {
        maxError = Math.max(maxError, tile.geometricError);
      });
      this.extremeDebugDepth = maxDepth;
      this.extremeDebugError = maxError;
    }
    fetchTileSet(...args) {
      const pr = super.fetchTileSet(...args);
      pr.then(() => {
        Promise.resolve().then(() => {
          this.initExtremes();
        });
      }).catch(() => {
      });
      return pr;
    }
    getTileInformationFromActiveObject(object) {
      let targetTile = null;
      const activeTiles = this.activeTiles;
      activeTiles.forEach((tile) => {
        if (targetTile) {
          return true;
        }
        const scene = tile.cached.scene;
        if (scene) {
          scene.traverse((c) => {
            if (c === object) {
              targetTile = tile;
            }
          });
        }
      });
      if (targetTile) {
        return {
          distanceToCamera: targetTile.__distanceFromCamera,
          geometricError: targetTile.geometricError,
          screenSpaceError: targetTile.__error,
          depth: targetTile.__depth,
          isLeaf: targetTile.__isLeaf
        };
      } else {
        return null;
      }
    }
    update() {
      super.update();
      if (!this.root) {
        return;
      }
      this.boxGroup.visible = this.displayBoxBounds;
      this.sphereGroup.visible = this.displaySphereBounds;
      this.regionGroup.visible = this.displayRegionBounds;
      let maxDepth = -1;
      if (this.maxDebugDepth === -1) {
        maxDepth = this.extremeDebugDepth;
      } else {
        maxDepth = this.maxDebugDepth;
      }
      let maxError = -1;
      if (this.maxDebugError === -1) {
        maxError = this.extremeDebugError;
      } else {
        maxError = this.maxDebugError;
      }
      let maxDistance = -1;
      if (this.maxDebugDistance === -1) {
        this.root.cached.boundingVolume.getSphere(_sphere);
        maxDistance = _sphere.radius;
      } else {
        maxDistance = this.maxDebugDistance;
      }
      const errorTarget = this.errorTarget;
      const colorMode = this.colorMode;
      const visibleTiles = this.visibleTiles;
      let sortedTiles;
      if (colorMode === LOAD_ORDER) {
        sortedTiles = Array.from(visibleTiles).sort((a, b) => {
          return a[LOAD_TIME] - b[LOAD_TIME];
        });
      }
      visibleTiles.forEach((tile) => {
        const scene = tile.cached.scene;
        let h, s, l;
        if (colorMode === RANDOM_COLOR) {
          h = Math.random();
          s = 0.5 + Math.random() * 0.5;
          l = 0.375 + Math.random() * 0.25;
        }
        scene.traverse((c) => {
          if (colorMode === RANDOM_NODE_COLOR) {
            h = Math.random();
            s = 0.5 + Math.random() * 0.5;
            l = 0.375 + Math.random() * 0.25;
          }
          const currMaterial = c.material;
          if (currMaterial) {
            const originalMaterial = c[ORIGINAL_MATERIAL];
            if (colorMode === NONE && currMaterial !== originalMaterial) {
              c.material.dispose();
              c.material = c[ORIGINAL_MATERIAL];
            } else if (colorMode !== NONE && currMaterial === originalMaterial) {
              if (c.isPoints) {
                const pointsMaterial = new import_three20.PointsMaterial();
                pointsMaterial.size = originalMaterial.size;
                pointsMaterial.sizeAttenuation = originalMaterial.sizeAttenuation;
                c.material = pointsMaterial;
              } else {
                c.material = new import_three20.MeshStandardMaterial();
                c.material.flatShading = true;
              }
            }
            if (colorMode !== RANDOM_COLOR) {
              delete c.material[HAS_RANDOM_COLOR];
            }
            if (colorMode !== RANDOM_NODE_COLOR) {
              delete c.material[HAS_RANDOM_NODE_COLOR];
            }
            switch (colorMode) {
              case DEPTH: {
                const val = tile.__depth / maxDepth;
                this.getDebugColor(val, c.material.color);
                break;
              }
              case RELATIVE_DEPTH: {
                const val = tile.__depthFromRenderedParent / maxDepth;
                this.getDebugColor(val, c.material.color);
                break;
              }
              case SCREEN_ERROR: {
                const val = tile.__error / errorTarget;
                if (val > 1) {
                  c.material.color.setRGB(1, 0, 0);
                } else {
                  this.getDebugColor(val, c.material.color);
                }
                break;
              }
              case GEOMETRIC_ERROR: {
                const val = Math.min(tile.geometricError / maxError, 1);
                this.getDebugColor(val, c.material.color);
                break;
              }
              case DISTANCE: {
                const val = Math.min(tile.__distanceFromCamera / maxDistance, 1);
                this.getDebugColor(val, c.material.color);
                break;
              }
              case IS_LEAF: {
                if (!tile.children || tile.children.length === 0) {
                  this.getDebugColor(1, c.material.color);
                } else {
                  this.getDebugColor(0, c.material.color);
                }
                break;
              }
              case RANDOM_NODE_COLOR: {
                if (!c.material[HAS_RANDOM_NODE_COLOR]) {
                  c.material.color.setHSL(h, s, l);
                  c.material[HAS_RANDOM_NODE_COLOR] = true;
                }
                break;
              }
              case RANDOM_COLOR: {
                if (!c.material[HAS_RANDOM_COLOR]) {
                  c.material.color.setHSL(h, s, l);
                  c.material[HAS_RANDOM_COLOR] = true;
                }
                break;
              }
              case CUSTOM_COLOR: {
                if (this.customColorCallback) {
                  this.customColorCallback(tile, c);
                } else {
                  console.warn("DebugTilesRenderer: customColorCallback not defined");
                }
                break;
              }
              case LOAD_ORDER: {
                const value = sortedTiles.indexOf(tile);
                this.getDebugColor(value / (sortedTiles.length - 1), c.material.color);
                break;
              }
            }
          }
        });
      });
    }
    parseTile(buffer, tile, ext) {
      tile[LOAD_TIME] = performance.now();
      return super.parseTile(buffer, tile, ext);
    }
    setTileVisible(tile, visible) {
      super.setTileVisible(tile, visible);
      const cached = tile.cached;
      const sphereGroup = this.sphereGroup;
      const boxGroup = this.boxGroup;
      const regionGroup = this.regionGroup;
      const boxHelperGroup = cached.boxHelperGroup;
      const sphereHelper = cached.sphereHelper;
      const regionHelper = cached.regionHelper;
      if (!visible) {
        if (boxHelperGroup) {
          boxGroup.remove(boxHelperGroup);
        }
        if (sphereHelper) {
          sphereGroup.remove(sphereHelper);
        }
        if (regionHelper) {
          regionGroup.remove(regionHelper);
        }
      } else {
        if (boxHelperGroup) {
          boxGroup.add(boxHelperGroup);
          boxHelperGroup.updateMatrixWorld(true);
        }
        if (sphereHelper) {
          sphereGroup.add(sphereHelper);
          sphereHelper.updateMatrixWorld(true);
        }
        if (regionHelper) {
          regionGroup.add(regionHelper);
          regionHelper.updateMatrixWorld(true);
        }
      }
    }
    parseTile(buffer, tile, extension) {
      return super.parseTile(buffer, tile, extension).then(() => {
        const cached = tile.cached;
        const scene = cached.scene;
        if (scene) {
          const { sphere, obb, region } = cached.boundingVolume;
          if (obb) {
            const boxHelperGroup = new import_three20.Group();
            boxHelperGroup.name = "DebugTilesRenderer.boxHelperGroup";
            boxHelperGroup.matrix.copy(obb.transform);
            boxHelperGroup.matrixAutoUpdate = false;
            const boxHelper = new import_three20.Box3Helper(obb.box, getIndexedRandomColor(tile.__depth));
            boxHelper.raycast = emptyRaycast;
            boxHelperGroup.add(boxHelper);
            cached.boxHelperGroup = boxHelperGroup;
            if (this.visibleTiles.has(tile) && this.displayBoxBounds) {
              this.boxGroup.add(boxHelperGroup);
              boxHelperGroup.updateMatrixWorld(true);
            }
          }
          if (sphere) {
            const sphereHelper = new SphereHelper(sphere, getIndexedRandomColor(tile.__depth));
            sphereHelper.raycast = emptyRaycast;
            cached.sphereHelper = sphereHelper;
            if (this.visibleTiles.has(tile) && this.displaySphereBounds) {
              this.sphereGroup.add(sphereHelper);
              sphereHelper.updateMatrixWorld(true);
            }
          }
          if (region) {
            const regionHelper = new EllipsoidRegionLineHelper(region, getIndexedRandomColor(tile.__depth));
            regionHelper.raycast = emptyRaycast;
            const sphere2 = new import_three20.Sphere();
            region.getBoundingSphere(sphere2);
            regionHelper.position.copy(sphere2.center);
            sphere2.center.multiplyScalar(-1);
            regionHelper.geometry.translate(...sphere2.center);
            cached.regionHelper = regionHelper;
            if (this.visibleTiles.has(tile) && this.displayRegionBounds) {
              this.regionGroup.add(regionHelper);
              regionHelper.updateMatrixWorld(true);
            }
          }
          scene.traverse((c) => {
            const material = c.material;
            if (material) {
              c[ORIGINAL_MATERIAL] = material;
            }
          });
        }
      });
    }
    disposeTile(tile) {
      super.disposeTile(tile);
      const cached = tile.cached;
      if (cached.boxHelperGroup) {
        cached.boxHelperGroup.children[0].geometry.dispose();
        delete cached.boxHelperGroup;
      }
      if (cached.sphereHelper) {
        cached.sphereHelper.geometry.dispose();
        delete cached.sphereHelper;
      }
    }
  };

  // package/src/three/math/GeoConstants.js
  var WGS84_ELLIPSOID = new Ellipsoid(WGS84_RADIUS, WGS84_RADIUS, WGS84_HEIGHT);

  // package/src/three/renderers/GoogleTilesRenderer.js
  var import_three21 = __require("three");

  // package/src/three/renderers/GoogleMapsTilesCredits.js
  var GoogleMapsTilesCredits = class {
    constructor() {
      this.creditsCount = {};
    }
    _adjustCredits(line, add) {
      const creditsCount = this.creditsCount;
      const tokens = line.split(/;/g);
      for (let i = 0, l = tokens.length; i < l; i++) {
        const t = tokens[i];
        if (!(t in creditsCount)) {
          creditsCount[t] = 0;
        }
        creditsCount[t] += add ? 1 : -1;
        if (creditsCount[t] <= 0) {
          delete creditsCount[t];
        }
      }
    }
    addCredits(line) {
      this._adjustCredits(line, true);
    }
    removeCredits(line) {
      this._adjustCredits(line, false);
    }
    toString() {
      const sortedByCount = Object.entries(this.creditsCount).sort((a, b) => {
        const countA = a[1];
        const countB = b[1];
        return countB - countA;
      });
      return sortedByCount.map((pair) => pair[0]).join("; ");
    }
  };

  // package/src/three/renderers/GoogleTilesRenderer.js
  var API_ORIGIN = "https://tile.googleapis.com";
  var TILE_URL = `${API_ORIGIN}/v1/3dtiles/root.json`;
  var _mat2 = new import_three21.Matrix4();
  var _euler = new import_three21.Euler();
  var GoogleTilesRendererMixin = (base) => class extends base {
    get ellipsoid() {
      return WGS84_ELLIPSOID;
    }
    constructor(apiKey, baseUrl = TILE_URL) {
      super(new URL(`${baseUrl}?key=${apiKey}`).toString());
      this._credits = new GoogleMapsTilesCredits();
      this.fetchOptions.mode = "cors";
      this.parseQueue.maxJobs = 10;
      this.downloadQueue.maxJobs = 30;
      this.lruCache.minSize = 3e3;
      this.lruCache.maxSize = 5e3;
      this.errorTarget = 40;
      const onLoadCallback = () => {
        let session;
        this.traverse((tile) => {
          if (tile.content && tile.content.uri) {
            session = new URL(tile.content.uri).searchParams.get("session");
            return true;
          }
          return false;
        });
        this.preprocessURL = (uri) => {
          uri = new URL(uri);
          if (/^http/.test(uri.protocol)) {
            uri.searchParams.append("session", session);
            uri.searchParams.append("key", apiKey);
          }
          return uri.toString();
        };
        this.removeEventListener("load-tile-set", onLoadCallback);
      };
      this.addEventListener("load-tile-set", onLoadCallback);
      this.addEventListener("tile-visibility-change", (e) => {
        const { tile, visible } = e;
        const copyright = tile.cached.metadata.asset.copyright || "";
        if (visible) {
          this._credits.addCredits(copyright);
        } else {
          this._credits.removeCredits(copyright);
        }
      });
    }
    getCreditsString() {
      return this._credits.toString();
    }
    // adjust the rotation of the group such that Y is altitude, X is North, and Z is East
    setLatLonToYUp(lat, lon) {
      const { ellipsoid, group } = this;
      _euler.set(Math.PI / 2, Math.PI / 2, 0);
      _mat2.makeRotationFromEuler(_euler);
      ellipsoid.constructLatLonFrame(lat, lon, group.matrix).multiply(_mat2).invert().decompose(
        group.position,
        group.quaternion,
        group.scale
      );
      group.updateMatrixWorld(true);
    }
  };
  var GoogleTilesRenderer = GoogleTilesRendererMixin(TilesRenderer);
  var DebugGoogleTilesRenderer = GoogleTilesRendererMixin(DebugTilesRenderer);

  // package/src/three/renderers/CesiumIonTilesRenderer.js
  var UNLOADED2 = 0;
  var LOADING2 = 1;
  var LOADED2 = 2;
  var FAILED2 = 3;
  var CesiumIonTilesRendererMixin = (base) => class extends base {
    constructor(ionAssetId, ionAccessToken) {
      super();
      this._tokenState = UNLOADED2;
      this._ionAccessToken = ionAccessToken;
      this._ionAssetId = ionAssetId;
      this._tileSetVersion = -1;
      this.preprocessURL = (uri) => {
        uri = new URL(uri);
        if (/^http/.test(uri.protocol) && this._tileSetVersion != -1) {
          uri.searchParams.append("v", this._tileSetVersion);
        }
        return uri.toString();
      };
    }
    update() {
      const state = this._tokenState;
      if (state === UNLOADED2) {
        this._tokenState = LOADING2;
        const url = new URL(`https://api.cesium.com/v1/assets/${this._ionAssetId}/endpoint`);
        url.searchParams.append("access_token", this._ionAccessToken);
        fetch(url, { mode: "cors" }).then((res) => {
          if (res.ok) {
            return res.json();
          } else {
            return Promise.reject(`${res.status} : ${res.statusText}`);
          }
        }).then((json) => {
          this._tokenState = LOADED2;
          const url2 = new URL(json.url);
          this._tileSetVersion = url2.searchParams.get("v");
          this.rootURL = url2;
          this.fetchOptions.headers = this.fetchOptions.headers || {};
          this.fetchOptions.headers.Authorization = `Bearer ${json.accessToken}`;
        }).catch(() => {
          this._tokenState = FAILED2;
        });
      } else if (state === LOADED2) {
        super.update();
      }
    }
  };
  var CesiumIonTilesRenderer = CesiumIonTilesRendererMixin(TilesRenderer);
  var DebugCesiumIonTilesRenderer = CesiumIonTilesRendererMixin(DebugTilesRenderer);

  // package/src/three/controls/GlobeControls.js
  var import_three26 = __require("three");

  // package/src/three/controls/EnvironmentControls.js
  var import_three25 = __require("three");

  // package/src/three/controls/PivotPointMesh.js
  var import_three22 = __require("three");
  var PivotPointMesh = class extends import_three22.Mesh {
    constructor() {
      super(new import_three22.PlaneGeometry(0, 0), new PivotMaterial());
      this.renderOrder = Infinity;
    }
    onBeforeRender(renderer) {
      const uniforms = this.material.uniforms;
      renderer.getSize(uniforms.resolution.value);
    }
    updateMatrixWorld() {
      this.matrixWorld.makeTranslation(this.position);
    }
    dispose() {
      this.geometry.dispose();
      this.material.dispose();
    }
  };
  var PivotMaterial = class extends import_three22.ShaderMaterial {
    constructor() {
      super({
        depthWrite: false,
        depthTest: false,
        transparent: true,
        uniforms: {
          resolution: { value: new import_three22.Vector2() },
          size: { value: 15 },
          thickness: { value: 2 },
          opacity: { value: 1 }
        },
        vertexShader: (
          /* glsl */
          `

				uniform float pixelRatio;
				uniform float size;
				uniform float thickness;
				uniform vec2 resolution;
				varying vec2 vUv;

				void main() {

					vUv = uv;

					float aspect = resolution.x / resolution.y;
					vec2 offset = uv * 2.0 - vec2( 1.0 );
					offset.y *= aspect;

					vec4 screenPoint = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
					screenPoint.xy += offset * ( size + thickness ) * screenPoint.w / resolution.x;

					gl_Position = screenPoint;

				}
			`
        ),
        fragmentShader: (
          /* glsl */
          `

				uniform float size;
				uniform float thickness;
				uniform float opacity;

				varying vec2 vUv;
				void main() {

					float ht = 0.5 * thickness;
					float planeDim = size + thickness;
					float offset = ( planeDim - ht - 2.0 ) / planeDim;
					float texelThickness = ht / planeDim;

					vec2 vec = vUv * 2.0 - vec2( 1.0 );
					float dist = abs( length( vec ) - offset );
					float fw = fwidth( dist ) * 0.5;
					float a = smoothstep( texelThickness - fw, texelThickness + fw, dist );

					gl_FragColor = vec4( 1, 1, 1, opacity * ( 1.0 - a ) );

				}
			`
        )
      });
    }
  };

  // package/src/three/controls/PointerTracker.js
  var import_three23 = __require("three");
  var PointerTracker = class {
    constructor(domElement) {
      this.domElement = domElement;
      this.buttons = 0;
      this.pointerType = null;
      this.pointerOrder = [];
      this.previousPositions = {};
      this.pointerPositions = {};
      this.startPositions = {};
      this.pointerSetThisFrame = {};
      this.hoverPosition = new import_three23.Vector2();
      this.hoverSet = false;
    }
    reset() {
      this.buttons = 0;
      this.pointerType = null;
      this.pointerOrder = [];
      this.previousPositions = {};
      this.pointerPositions = {};
      this.startPositions = {};
      this.pointerSetThisFrame = {};
      this.hoverPosition = new import_three23.Vector2();
      this.hoverSet = false;
    }
    // The pointers can be set multiple times per frame so track whether the pointer has
    // been set this frame or not so we don't overwrite the previous position and lose information
    // about pointer movement
    updateFrame() {
      const { previousPositions, pointerPositions } = this;
      for (const id in pointerPositions) {
        previousPositions[id].copy(pointerPositions[id]);
      }
    }
    setHoverEvent(e) {
      if (e.pointerType === "mouse") {
        this.getAdjustedPointer(e, this.hoverPosition);
        this.hoverSet = true;
      }
    }
    getLatestPoint(target) {
      if (this.pointerType !== null) {
        this.getCenterPoint(target);
        return target;
      } else if (this.hoverSet) {
        target.copy(this.hoverPosition);
        return target;
      } else {
        return null;
      }
    }
    // get the pointer position in the coordinate system of the target element
    getAdjustedPointer(e, target) {
      const domRef = this.domElement ? this.domElement : e.target;
      const rect = domRef.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      target.set(x, y);
    }
    addPointer(e) {
      const id = e.pointerId;
      const position = new import_three23.Vector2();
      this.getAdjustedPointer(e, position);
      this.pointerOrder.push(id);
      this.pointerPositions[id] = position;
      this.previousPositions[id] = position.clone();
      this.startPositions[id] = position.clone();
      if (this.getPointerCount() === 1) {
        this.pointerType = e.pointerType;
        this.buttons = e.buttons;
      }
    }
    updatePointer(e) {
      const id = e.pointerId;
      if (!(id in this.pointerPositions)) {
        return false;
      }
      this.getAdjustedPointer(e, this.pointerPositions[id]);
      return true;
    }
    deletePointer(e) {
      const id = e.pointerId;
      const pointerOrder = this.pointerOrder;
      pointerOrder.splice(pointerOrder.indexOf(id), 1);
      delete this.pointerPositions[id];
      delete this.previousPositions[id];
      delete this.startPositions[id];
      if (this.getPointerCount.length === 0) {
        this.buttons = 0;
        this.pointerType = null;
      }
    }
    getPointerCount() {
      return this.pointerOrder.length;
    }
    getCenterPoint(target, pointerPositions = this.pointerPositions) {
      const pointerOrder = this.pointerOrder;
      if (this.getPointerCount() === 1 || this.getPointerType() === "mouse") {
        const id = pointerOrder[0];
        target.copy(pointerPositions[id]);
        return target;
      } else if (this.getPointerCount() === 2) {
        const id0 = this.pointerOrder[0];
        const id1 = this.pointerOrder[1];
        const p0 = pointerPositions[id0];
        const p1 = pointerPositions[id1];
        target.addVectors(p0, p1).multiplyScalar(0.5);
        return target;
      }
      return null;
    }
    getPreviousCenterPoint(target) {
      return this.getCenterPoint(target, this.previousPositions);
    }
    getStartCenterPoint(target) {
      return this.getCenterPoint(target, this.startPositions);
    }
    getPointerDistance(pointerPositions = this.pointerPositions) {
      if (this.getPointerCount() <= 1 || this.getPointerType() === "mouse") {
        return 0;
      }
      const { pointerOrder } = this;
      const id0 = pointerOrder[0];
      const id1 = pointerOrder[1];
      const p0 = pointerPositions[id0];
      const p1 = pointerPositions[id1];
      return p0.distanceTo(p1);
    }
    getPreviousPointerDistance() {
      return this.getPointerDistance(this.previousPositions);
    }
    getStartPointerDistance() {
      return this.getPointerDistance(this.startPositions);
    }
    getPointerType() {
      return this.pointerType;
    }
    getPointerButtons() {
      return this.buttons;
    }
    isLeftClicked() {
      return Boolean(this.buttons & 1);
    }
    isRightClicked() {
      return Boolean(this.buttons & 2);
    }
  };

  // package/src/three/controls/utils.js
  var import_three24 = __require("three");
  var _matrix = new import_three24.Matrix4();
  function makeRotateAroundPoint(point, quat, target) {
    target.makeTranslation(-point.x, -point.y, -point.z);
    _matrix.makeRotationFromQuaternion(quat);
    target.premultiply(_matrix);
    _matrix.makeTranslation(point.x, point.y, point.z);
    target.premultiply(_matrix);
    return target;
  }
  function mouseToCoords(clientX, clientY, element, target) {
    target.x = (clientX - element.offsetLeft) / element.clientWidth * 2 - 1;
    target.y = -((clientY - element.offsetTop) / element.clientHeight) * 2 + 1;
  }

  // package/src/three/controls/EnvironmentControls.js
  var NONE2 = 0;
  var DRAG = 1;
  var ROTATE = 2;
  var ZOOM = 3;
  var WAITING = 4;
  var DRAG_PLANE_THRESHOLD = 0.05;
  var DRAG_UP_THRESHOLD = 0.025;
  var _rotMatrix = new import_three25.Matrix4();
  var _delta = new import_three25.Vector3();
  var _vec5 = new import_three25.Vector3();
  var _forward = new import_three25.Vector3();
  var _right = new import_three25.Vector3();
  var _rotationAxis = new import_three25.Vector3();
  var _quaternion = new import_three25.Quaternion();
  var _plane = new import_three25.Plane();
  var _localUp = new import_three25.Vector3();
  var _pointer = new import_three25.Vector2();
  var _prevPointer = new import_three25.Vector2();
  var _deltaPointer = new import_three25.Vector2();
  var _centerPoint = new import_three25.Vector2();
  var _startCenterPoint = new import_three25.Vector2();
  var _changeEvent = { type: "change" };
  var _startEvent = { type: "start" };
  var _endEvent = { type: "end" };
  var EnvironmentControls = class extends import_three25.EventDispatcher {
    get enabled() {
      return this._enabled || true;
    }
    set enabled(v) {
      if (v !== this.enabled) {
        this.resetState();
        this.pointerTracker.reset();
        this._enabled = v;
      }
    }
    constructor(scene = null, camera = null, domElement = null) {
      super();
      this.domElement = null;
      this.camera = null;
      this.scene = null;
      this._enabled = true;
      this.state = NONE2;
      this.pinchState = NONE2;
      this.cameraRadius = 5;
      this.rotationSpeed = 5;
      this.minAltitude = 0;
      this.maxAltitude = 0.45 * Math.PI;
      this.minZoomDistance = 10;
      this.maxZoomDistance = Infinity;
      this.reorientOnDrag = true;
      this.reorientOnZoom = false;
      this.adjustHeight = true;
      this.pointerTracker = new PointerTracker(domElement);
      this.needsUpdate = false;
      this.actionHeightOffset = 0;
      this.dragPointSet = false;
      this.dragPoint = new import_three25.Vector3();
      this.rotationPointSet = false;
      this.rotationPoint = new import_three25.Vector3();
      this.zoomDirectionSet = false;
      this.zoomPointSet = false;
      this.zoomDirection = new import_three25.Vector3();
      this.zoomPoint = new import_three25.Vector3();
      this.zoomDelta = 0;
      this.pivotMesh = new PivotPointMesh();
      this.pivotMesh.raycast = () => {
      };
      this.pivotMesh.scale.setScalar(0.25);
      this.raycaster = new import_three25.Raycaster();
      this.raycaster.firstHitOnly = true;
      this.up = new import_three25.Vector3(0, 1, 0);
      this._detachCallback = null;
      this._upInitialized = false;
      this.attach(domElement);
      this.setCamera(camera);
      this.setScene(scene);
    }
    setScene(scene) {
      this.scene = scene;
    }
    setCamera(camera) {
      this.camera = camera;
    }
    attach(domElement) {
      if (this.domElement) {
        throw new Error("EnvironmentControls: Controls already attached to element");
      }
      this.domElement = domElement;
      this.pointerTracker.domElement = domElement;
      domElement.style.touchAction = "none";
      let shiftClicked = false;
      const contextMenuCallback = (e) => {
        e.preventDefault();
      };
      const keydownCallback = (e) => {
        if (e.key === "Shift") {
          shiftClicked = true;
        }
      };
      const keyupCallback = (e) => {
        if (e.key === "Shift") {
          shiftClicked = false;
        }
      };
      const pointerdownCallback = (e) => {
        e.preventDefault();
        const {
          camera,
          raycaster,
          domElement: domElement2,
          scene,
          up,
          pivotMesh,
          pointerTracker
        } = this;
        pointerTracker.addPointer(e);
        this.needsUpdate = true;
        if (pointerTracker.getPointerType() === "touch") {
          pivotMesh.visible = false;
          if (pointerTracker.getPointerCount() === 0) {
            domElement2.setPointerCapture(e.pointerId);
          } else if (pointerTracker.getPointerCount() > 2) {
            this.resetState();
            return;
          }
        }
        pointerTracker.getCenterPoint(_pointer);
        mouseToCoords(_pointer.x, _pointer.y, domElement2, _pointer);
        raycaster.setFromCamera(_pointer, camera);
        const hit = raycaster.intersectObject(scene)[0] || null;
        if (hit) {
          if (pointerTracker.getPointerCount() === 2 || pointerTracker.isRightClicked() || pointerTracker.isLeftClicked() && shiftClicked) {
            this.setState(ROTATE);
            this.rotationPoint.copy(hit.point);
            this.rotationPointSet = true;
            this.pivotMesh.position.copy(hit.point);
            this.pivotMesh.updateMatrixWorld();
            this.scene.add(this.pivotMesh);
          } else if (pointerTracker.isLeftClicked()) {
            if (raycaster.ray.direction.dot(up) < 0) {
              this.setState(DRAG);
              this.dragPoint.copy(hit.point);
              this.dragPointSet = true;
              this.pivotMesh.position.copy(hit.point);
              this.pivotMesh.updateMatrixWorld();
              this.scene.add(this.pivotMesh);
            }
          }
        }
      };
      let _pointerMoveQueued = false;
      const pointermoveCallback = (e) => {
        e.preventDefault();
        this.zoomDirectionSet = false;
        this.zoomPointSet = false;
        this.needsUpdate = true;
        const { pointerTracker } = this;
        pointerTracker.setHoverEvent(e);
        if (!pointerTracker.updatePointer(e)) {
          return;
        }
        if (pointerTracker.getPointerType() === "touch") {
          if (pointerTracker.getPointerCount() === 2) {
            if (this.state === DRAG) {
              this.setState(NONE2, WAITING, false);
            }
            if (!_pointerMoveQueued) {
              _pointerMoveQueued = true;
              queueMicrotask(() => {
                _pointerMoveQueued = false;
                pointerTracker.getCenterPoint(_centerPoint);
                const startDist = pointerTracker.getStartPointerDistance();
                const pointerDist = pointerTracker.getPointerDistance();
                const separateDelta = pointerDist - startDist;
                if (this.pinchState === NONE2 || this.pinchState === WAITING) {
                  pointerTracker.getCenterPoint(_centerPoint);
                  pointerTracker.getStartCenterPoint(_startCenterPoint);
                  const dpr = window.devicePixelRatio;
                  const parallelDelta = _centerPoint.distanceTo(_startCenterPoint);
                  if (Math.abs(separateDelta) > dpr || parallelDelta > dpr) {
                    if (Math.abs(separateDelta) > parallelDelta) {
                      this.setState(NONE2, ZOOM);
                      this.zoomDirectionSet = false;
                    } else {
                      this.setState(NONE2, ROTATE);
                    }
                  }
                }
                if (this.pinchState === ZOOM) {
                  const previousDist = pointerTracker.getPreviousPointerDistance();
                  this.zoomDelta += pointerDist - previousDist;
                } else if (this.pinchState === ROTATE) {
                  this.pivotMesh.visible = true;
                }
              });
            }
          }
        }
      };
      const pointerupCallback = (e) => {
        const { pointerTracker } = this;
        pointerTracker.deletePointer(e);
        if (pointerTracker.getPointerType() === "touch" && pointerTracker.getPointerCount() === 0) {
          domElement.releasePointerCapture(e.pointerId);
        }
        this.resetState();
        this.needsUpdate = true;
      };
      const wheelCallback = (e) => {
        e.preventDefault();
        this.dispatchEvent(_startEvent);
        let delta;
        switch (e.deltaMode) {
          case 2:
            delta = e.deltaY * 100;
            break;
          case 1:
            delta = e.deltaY * 16;
            break;
          case 0:
            delta = e.deltaY;
            break;
        }
        const deltaSign = Math.sign(delta);
        const normalizedDelta = Math.log(Math.abs(delta) + 1);
        this.zoomDelta -= 3 * deltaSign * normalizedDelta;
        this.needsUpdate = true;
        this.dispatchEvent(_endEvent);
      };
      const pointerenterCallback = (e) => {
        const { pointerTracker } = this;
        shiftClicked = false;
        if (e.buttons !== pointerTracker.getPointerButtons()) {
          pointerTracker.deletePointer(e);
          this.resetState();
        }
      };
      domElement.addEventListener("contextmenu", contextMenuCallback);
      domElement.addEventListener("keydown", keydownCallback);
      domElement.addEventListener("keyup", keyupCallback);
      domElement.addEventListener("pointerdown", pointerdownCallback);
      domElement.addEventListener("pointermove", pointermoveCallback);
      domElement.addEventListener("pointerup", pointerupCallback);
      domElement.addEventListener("wheel", wheelCallback);
      domElement.addEventListener("pointerenter", pointerenterCallback);
      this._detachCallback = () => {
        domElement.removeEventListener("contextmenu", contextMenuCallback);
        domElement.removeEventListener("keydown", keydownCallback);
        domElement.removeEventListener("keyup", keyupCallback);
        domElement.removeEventListener("pointerdown", pointerdownCallback);
        domElement.removeEventListener("pointermove", pointermoveCallback);
        domElement.removeEventListener("pointerup", pointerupCallback);
        domElement.removeEventListener("wheel", wheelCallback);
        domElement.removeEventListener("pointerenter", pointerenterCallback);
      };
    }
    getUpDirection(point, target) {
      target.copy(this.up);
    }
    detach() {
      if (this._detachCallback) {
        this._detachCallback();
        this._detachCallback = null;
        this.pointerTracker.reset();
      }
    }
    resetState() {
      if (this.state !== NONE2 || this.pinchState !== NONE2) {
        this.dispatchEvent(_endEvent);
      }
      this.state = NONE2;
      this.pinchState = NONE2;
      this.dragPointSet = false;
      this.rotationPointSet = false;
      this.scene.remove(this.pivotMesh);
      this.pivotMesh.visible = true;
      this.actionHeightOffset = 0;
    }
    setState(state = this.state, pinchState = this.pinchState, fireEvent = true) {
      if (this.state === state && this.pinchState === pinchState) {
        return;
      }
      if (this.state === NONE2 && this.pinchState === NONE2 && fireEvent) {
        this.dispatchEvent(_startEvent);
      }
      this.state = state;
      this.pinchState = pinchState;
    }
    update() {
      if (!this.enabled) {
        return;
      }
      const {
        camera,
        cameraRadius,
        dragPoint,
        up,
        state,
        pinchState,
        adjustHeight
      } = this;
      if (this.needsUpdate) {
        const action = state || pinchState;
        const zoomDelta = this.zoomDelta;
        if (action === DRAG) {
          this._updatePosition();
        }
        if (action === ROTATE) {
          this._updateRotation();
        }
        if (action === ZOOM || zoomDelta !== 0) {
          this._updateZoom();
        }
        if (action !== NONE2 || zoomDelta !== 0) {
          this.dispatchEvent(_changeEvent);
        }
        this.needsUpdate = false;
      }
      const hit = adjustHeight && this._getPointBelowCamera() || null;
      this.getUpDirection(camera.position, _localUp);
      if (!this._upInitialized) {
        this._upInitialized = true;
        this.up.copy(_localUp);
      } else {
        this._setFrame(_localUp, hit && hit.point || null);
      }
      if ((this.state === DRAG || this.state === ROTATE) && this.actionHeightOffset !== 0) {
        const { actionHeightOffset } = this;
        camera.position.addScaledVector(up, -actionHeightOffset);
        dragPoint.addScaledVector(up, -actionHeightOffset);
        if (hit) {
          hit.distance -= actionHeightOffset;
        }
      }
      this.actionHeightOffset = 0;
      if (hit) {
        const dist = hit.distance;
        if (dist < cameraRadius) {
          const delta = cameraRadius - dist;
          camera.position.addScaledVector(up, delta);
          dragPoint.addScaledVector(up, delta);
          this.actionHeightOffset = delta;
        }
      }
      this.pointerTracker.updateFrame();
    }
    dispose() {
      this.detach();
    }
    // private
    _updateZoom() {
      const {
        zoomPoint,
        zoomDirection,
        camera,
        minZoomDistance,
        maxZoomDistance,
        raycaster,
        pointerTracker,
        domElement
      } = this;
      let scale = this.zoomDelta;
      this.zoomDelta = 0;
      if (!pointerTracker.getLatestPoint(_pointer)) {
        return;
      }
      mouseToCoords(_pointer.x, _pointer.y, domElement, _pointer);
      raycaster.setFromCamera(_pointer, camera);
      zoomDirection.copy(raycaster.ray.direction).normalize();
      this.zoomDirectionSet = true;
      const finalZoomDirection = _vec5.copy(zoomDirection);
      let dist = Infinity;
      if (this._updateZoomPoint()) {
        dist = zoomPoint.distanceTo(camera.position);
        if (scale < 0) {
          const remainingDistance = Math.min(0, dist - maxZoomDistance);
          scale = scale * dist * 0.01;
          scale = Math.max(scale, remainingDistance);
        } else {
          const remainingDistance = Math.max(0, dist - minZoomDistance);
          scale = scale * (dist - minZoomDistance) * 0.01;
          scale = Math.min(scale, remainingDistance);
        }
        camera.position.addScaledVector(zoomDirection, scale);
        camera.updateMatrixWorld();
      } else {
        const hit = this._getPointBelowCamera();
        if (hit) {
          dist = hit.distance;
          finalZoomDirection.set(0, 0, -1).transformDirection(camera.matrixWorld);
          camera.position.addScaledVector(finalZoomDirection, scale * dist * 0.01);
          camera.updateMatrixWorld();
        }
      }
    }
    // update the point being zoomed in to based on the zoom direction
    _updateZoomPoint() {
      const {
        camera,
        zoomDirectionSet,
        zoomDirection,
        raycaster,
        scene,
        zoomPoint
      } = this;
      if (!zoomDirectionSet) {
        return false;
      }
      raycaster.ray.origin.copy(camera.position);
      raycaster.ray.direction.copy(zoomDirection);
      const hit = raycaster.intersectObject(scene)[0] || null;
      if (hit) {
        zoomPoint.copy(hit.point);
        this.zoomPointSet = true;
        return true;
      }
      return false;
    }
    // returns the point below the camera
    _getPointBelowCamera() {
      const { camera, raycaster, scene, up } = this;
      raycaster.ray.direction.copy(up).multiplyScalar(-1);
      raycaster.ray.origin.copy(camera.position).addScaledVector(up, 1e5);
      const hit = raycaster.intersectObject(scene)[0] || null;
      if (hit) {
        hit.distance -= 1e5;
      }
      return hit;
    }
    // update the drag action
    _updatePosition() {
      const {
        raycaster,
        camera,
        dragPoint,
        up,
        pointerTracker,
        domElement
      } = this;
      pointerTracker.getCenterPoint(_pointer);
      mouseToCoords(_pointer.x, _pointer.y, domElement, _pointer);
      _plane.setFromNormalAndCoplanarPoint(up, dragPoint);
      raycaster.setFromCamera(_pointer, camera);
      if (-raycaster.ray.direction.dot(up) < DRAG_PLANE_THRESHOLD) {
        const angle = Math.acos(DRAG_PLANE_THRESHOLD);
        _rotationAxis.crossVectors(raycaster.ray.direction, up).normalize();
        raycaster.ray.direction.copy(up).applyAxisAngle(_rotationAxis, angle).multiplyScalar(-1);
      }
      this.getUpDirection(dragPoint, _localUp);
      if (-raycaster.ray.direction.dot(_localUp) < DRAG_UP_THRESHOLD) {
        const angle = Math.acos(DRAG_UP_THRESHOLD);
        _rotationAxis.crossVectors(raycaster.ray.direction, _localUp).normalize();
        raycaster.ray.direction.copy(_localUp).applyAxisAngle(_rotationAxis, angle).multiplyScalar(-1);
      }
      if (raycaster.ray.intersectPlane(_plane, _vec5)) {
        _delta.subVectors(dragPoint, _vec5);
        this.camera.position.add(_delta);
        this.camera.updateMatrixWorld();
      }
    }
    _updateRotation() {
      const {
        camera,
        rotationPoint,
        minAltitude,
        maxAltitude,
        up,
        pointerTracker,
        rotationSpeed
      } = this;
      pointerTracker.getCenterPoint(_pointer);
      pointerTracker.getPreviousCenterPoint(_prevPointer);
      _deltaPointer.subVectors(_pointer, _prevPointer).multiplyScalar(0.01 / devicePixelRatio);
      const azimuth = -_deltaPointer.x * rotationSpeed;
      let altitude = _deltaPointer.y * rotationSpeed;
      _forward.set(0, 0, -1).transformDirection(camera.matrixWorld).multiplyScalar(-1);
      this.getUpDirection(rotationPoint, _localUp);
      _vec5.crossVectors(up, _forward).normalize();
      _right.set(1, 0, 0).transformDirection(camera.matrixWorld).normalize();
      const sign = Math.sign(_vec5.dot(_right));
      const angle = sign * up.angleTo(_forward);
      if (altitude > 0) {
        altitude = Math.min(angle - minAltitude - 0.01, altitude);
        altitude = Math.max(0, altitude);
      } else {
        altitude = Math.max(angle - maxAltitude, altitude);
        altitude = Math.min(0, altitude);
      }
      _quaternion.setFromAxisAngle(_localUp, azimuth);
      makeRotateAroundPoint(rotationPoint, _quaternion, _rotMatrix);
      camera.matrixWorld.premultiply(_rotMatrix);
      _rotationAxis.set(-1, 0, 0).transformDirection(camera.matrixWorld);
      _quaternion.setFromAxisAngle(_rotationAxis, altitude);
      makeRotateAroundPoint(rotationPoint, _quaternion, _rotMatrix);
      camera.matrixWorld.premultiply(_rotMatrix);
      camera.matrixWorld.decompose(camera.position, camera.quaternion, _vec5);
    }
    // sets the "up" axis for the current surface of the tile set
    _setFrame(newUp, pivot) {
      const { up, camera, state, pinchState, zoomPoint, zoomDirection } = this;
      camera.updateMatrixWorld();
      _quaternion.setFromUnitVectors(up, newUp);
      const action = state || pinchState;
      if (this.zoomDirectionSet && (this.zoomPointSet || this._updateZoomPoint())) {
        if (this.reorientOnZoom) {
          makeRotateAroundPoint(zoomPoint, _quaternion, _rotMatrix);
          camera.matrixWorld.premultiply(_rotMatrix);
          camera.matrixWorld.decompose(camera.position, camera.quaternion, _vec5);
          zoomDirection.subVectors(zoomPoint, camera.position).normalize();
        }
      } else if (action === NONE2 || action === DRAG && this.reorientOnDrag) {
        if (pivot) {
          makeRotateAroundPoint(pivot, _quaternion, _rotMatrix);
          camera.matrixWorld.premultiply(_rotMatrix);
          camera.matrixWorld.decompose(camera.position, camera.quaternion, _vec5);
        }
      }
      up.copy(newUp);
      camera.updateMatrixWorld();
    }
  };

  // package/src/three/controls/GlobeControls.js
  var _invMatrix2 = new import_three26.Matrix4();
  var _rotMatrix2 = new import_three26.Matrix4();
  var _pos3 = new import_three26.Vector3();
  var _vec6 = new import_three26.Vector3();
  var _center = new import_three26.Vector3();
  var _up = new import_three26.Vector3();
  var _forward2 = new import_three26.Vector3();
  var _right2 = new import_three26.Vector3();
  var _targetRight = new import_three26.Vector3();
  var _globalUp = new import_three26.Vector3();
  var _quaternion2 = new import_three26.Quaternion();
  var _latLon = {};
  var _pointer2 = new import_three26.Vector2();
  var _prevPointer2 = new import_three26.Vector2();
  var _deltaPointer2 = new import_three26.Vector2();
  var MAX_GLOBE_DISTANCE = 2 * 1e7;
  var GLOBE_TRANSITION_THRESHOLD = 0.75 * 1e7;
  var GlobeControls = class extends EnvironmentControls {
    get ellipsoid() {
      return this._tilesRenderer ? this._tilesRenderer.ellipsoid : null;
    }
    get tilesGroup() {
      return this._tilesRenderer ? this._tilesRenderer.group : null;
    }
    constructor(scene = null, camera = null, domElement = null, tilesRenderer = null) {
      super(scene, camera, domElement);
      this._tilesRenderer = null;
      this._dragMode = 0;
      this._rotationMode = 0;
      this.setTilesRenderer(tilesRenderer);
    }
    setTilesRenderer(tilesRenderer) {
      this._tilesRenderer = tilesRenderer;
      if (this.scene === null && this._tilesRenderer !== null) {
        this.setScene(this._tilesRenderer.group);
      }
    }
    setScene(scene) {
      if (scene === null && this._tilesRenderer !== null) {
        super.setScene(this._tilesRenderer.group);
      } else {
        super.setScene(scene);
      }
    }
    // get the vector to the center of the provided globe
    getVectorToCenter(target) {
      const { tilesGroup, camera } = this;
      return target.setFromMatrixPosition(tilesGroup.matrixWorld).sub(camera.position);
    }
    // get the distance to the center of the globe
    getDistanceToCenter() {
      return this.getVectorToCenter(_vec6).length();
    }
    getUpDirection(point, target) {
      const { tilesGroup, ellipsoid } = this;
      const invMatrix = _invMatrix2.copy(tilesGroup.matrixWorld).invert();
      const pos = _vec6.copy(point).applyMatrix4(invMatrix);
      ellipsoid.getPositionToNormal(pos, target);
      target.transformDirection(tilesGroup.matrixWorld);
    }
    update() {
      super.update();
      const {
        camera,
        tilesGroup,
        pivotMesh,
        ellipsoid
      } = this;
      let distanceToCenter = this.getDistanceToCenter();
      if (distanceToCenter > MAX_GLOBE_DISTANCE) {
        _vec6.setFromMatrixPosition(tilesGroup.matrixWorld).sub(camera.position).normalize().multiplyScalar(-1);
        camera.position.setFromMatrixPosition(tilesGroup.matrixWorld).addScaledVector(_vec6, MAX_GLOBE_DISTANCE);
        camera.updateMatrixWorld();
        distanceToCenter = MAX_GLOBE_DISTANCE;
      }
      if (distanceToCenter > GLOBE_TRANSITION_THRESHOLD) {
        if (this.state !== NONE2 && this._dragMode !== 1 && this._rotationMode !== 1) {
          pivotMesh.visible = false;
        }
        this.reorientOnDrag = false;
        this.reorientOnZoom = true;
      } else {
        this.reorientOnDrag = true;
        this.reorientOnZoom = false;
      }
      const largestDistance = Math.max(...ellipsoid.radius);
      const margin = 0.25 * largestDistance;
      const alpha = import_three26.MathUtils.clamp((distanceToCenter - largestDistance) / margin, 0, 1);
      const minNear = import_three26.MathUtils.lerp(1, 1e3, alpha);
      camera.near = Math.max(minNear, distanceToCenter - largestDistance - margin);
      const invMatrix = _invMatrix2.copy(tilesGroup.matrixWorld).invert();
      _pos3.copy(camera.position).applyMatrix4(invMatrix);
      ellipsoid.getPositionToCartographic(_pos3, _latLon);
      const elevation = ellipsoid.getPositionElevation(_pos3);
      const horizonDistance = ellipsoid.calculateHorizonDistance(_latLon.lat, elevation);
      camera.far = horizonDistance + 0.1;
      camera.updateProjectionMatrix();
    }
    // resets the "stuck" drag modes
    resetState() {
      super.resetState();
      this._dragMode = 0;
      this._rotationMode = 0;
    }
    // animate the frame to align to an up direction
    setFrame(...args) {
      super.setFrame(...args);
      if (this.getDistanceToCenter() < GLOBE_TRANSITION_THRESHOLD) {
        this._alignCameraUp(this.up);
      }
    }
    _updatePosition(...args) {
      if (this._dragMode === 1 || this.getDistanceToCenter() < GLOBE_TRANSITION_THRESHOLD) {
        this._dragMode = 1;
        super._updatePosition(...args);
      } else {
        this._dragMode = -1;
        const {
          pointerTracker,
          rotationSpeed,
          camera,
          pivotMesh,
          dragPoint,
          tilesGroup
        } = this;
        pointerTracker.getCenterPoint(_pointer2);
        pointerTracker.getPreviousCenterPoint(_prevPointer2);
        _deltaPointer2.subVectors(_pointer2, _prevPointer2).multiplyScalar(camera.position.distanceTo(dragPoint) * 1e-10 / devicePixelRatio);
        const azimuth = -_deltaPointer2.x * rotationSpeed;
        const altitude = -_deltaPointer2.y * rotationSpeed;
        _center.setFromMatrixPosition(tilesGroup.matrixWorld);
        _right2.set(1, 0, 0).transformDirection(camera.matrixWorld);
        _up.set(0, 1, 0).transformDirection(camera.matrixWorld);
        _quaternion2.setFromAxisAngle(_right2, altitude);
        camera.quaternion.premultiply(_quaternion2);
        makeRotateAroundPoint(_center, _quaternion2, _rotMatrix2);
        camera.matrixWorld.premultiply(_rotMatrix2);
        _quaternion2.setFromAxisAngle(_up, azimuth);
        camera.quaternion.premultiply(_quaternion2);
        makeRotateAroundPoint(_center, _quaternion2, _rotMatrix2);
        camera.matrixWorld.premultiply(_rotMatrix2);
        camera.matrixWorld.decompose(camera.position, camera.quaternion, _vec6);
        pivotMesh.visible = false;
      }
    }
    // disable rotation once we're outside the control transition
    _updateRotation(...args) {
      if (this._rotationMode === 1 || this.getDistanceToCenter() < GLOBE_TRANSITION_THRESHOLD) {
        this._rotationMode = 1;
        super._updateRotation(...args);
      } else {
        this.pivotMesh.visible = false;
        this._rotationMode = -1;
      }
    }
    _updateZoom() {
      const scale = this.zoomDelta;
      if (this.getDistanceToCenter() < GLOBE_TRANSITION_THRESHOLD || scale > 0) {
        super._updateZoom();
      } else {
        const alpha = import_three26.MathUtils.mapLinear(this.getDistanceToCenter(), GLOBE_TRANSITION_THRESHOLD, MAX_GLOBE_DISTANCE, 0, 1);
        this._tiltTowardsCenter(import_three26.MathUtils.lerp(1, 0.8, alpha));
        this._alignCameraUpToNorth(import_three26.MathUtils.lerp(1, 0.9, alpha));
        this.getVectorToCenter(_vec6);
        this.camera.position.addScaledVector(_vec6, scale * 25e-4);
        this.camera.updateMatrixWorld();
        this.zoomDelta = 0;
      }
    }
    // tilt the camera to align with north
    _alignCameraUpToNorth(alpha) {
      const { tilesGroup } = this;
      _globalUp.set(0, 0, 1).transformDirection(tilesGroup.matrixWorld);
      this._alignCameraUp(_globalUp, alpha);
    }
    // tilt the camera to align with the provided "up" value
    _alignCameraUp(up, alpha = null) {
      const { camera } = this;
      _forward2.set(0, 0, -1).transformDirection(camera.matrixWorld);
      _right2.set(-1, 0, 0).transformDirection(camera.matrixWorld);
      _targetRight.crossVectors(up, _forward2);
      if (alpha === null) {
        alpha = Math.abs(_forward2.dot(up));
      }
      _targetRight.lerp(_right2, alpha).normalize();
      _quaternion2.setFromUnitVectors(_right2, _targetRight);
      camera.quaternion.premultiply(_quaternion2);
      camera.updateMatrixWorld();
    }
    // tilt the camera to look at the center of the globe
    _tiltTowardsCenter(alpha) {
      const {
        camera,
        tilesGroup
      } = this;
      _forward2.set(0, 0, -1).transformDirection(camera.matrixWorld).normalize();
      _vec6.setFromMatrixPosition(tilesGroup.matrixWorld).sub(camera.position).normalize();
      _vec6.lerp(_forward2, alpha).normalize();
      _quaternion2.setFromUnitVectors(_forward2, _vec6);
      camera.quaternion.premultiply(_quaternion2);
      camera.updateMatrixWorld();
    }
  };
  return __toCommonJS(index_exports);
})();

window.TilesRenderer = TilesRendererLib.TilesRenderer || TilesRendererLib;