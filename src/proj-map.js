/**
 * Raster Map Projection v0.0.22  2018-01-02
 * Copyright (C) 2016-2018 T.Seno
 * All rights reserved.
 * @license GPL v3 License (http://www.gnu.org/licenses/gpl.html)
 */
'use strict';

if (typeof module!='undefined' && module.exports) {
  var ProjMath = require('./rasterproj-common.js');
}

// -----------------------------------------------------

/**
 * ラスタタイル情報管理
 * @param {number} rootNumX
 * @param {number} rootNumY
 * @param {number} numLevels
 * @constructor
 */
var TileManager = function(tileOpts) {
  this.rootNumX = 2;
  this.rootNumY = 1;
  this.rootTileSizeX = Math.PI;
  this.rootTileSizeY = Math.PI;
  this.numLevels = 1;
  this.inverseY = false;
  this.tileOrigin = [-Math.PI, -Math.PI/2];     // lower left
  //
  this.tileDomain = [-Math.PI, -Math.PI/2, +Math.PI, +Math.PI/2];   //  タイル領域全体
  //
  this.dataLevelDef = null;
  this.tileUrlDef = null;
  //
  if (typeof tileOpts !== 'undefined') {
    if ('rootNumX' in tileOpts) {
      this.rootNumX = tileOpts.rootNumX;
    }
    if ('rootNumY' in tileOpts) {
      this.rootNumY = tileOpts.rootNumY;
    }
    if ('rootTileSizeX' in tileOpts) {
      this.rootTileSizeX = tileOpts.rootTileSizeX;
    }
    if ('rootTileSizeY' in tileOpts) {
      this.rootTileSizeY = tileOpts.rootTileSizeY;
    }
    if ('numLevels' in tileOpts) {
      this.numLevels = tileOpts.numLevels;
    }
    if ('inverseY' in tileOpts) {
      this.inverseY = tileOpts.inverseY;
    }
    if ('tileOrigin' in tileOpts) {
      this.tileOrigin = tileOpts.tileOrigin;
    }
    if ('dataLevelDef' in tileOpts) {
      this.dataLevelDef = tileOpts.dataLevelDef;
    }
    if ('tileUrlDef' in tileOpts) {
      this.tileUrlDef = tileOpts.tileUrlDef;
    }
  }
};

TileManager.prototype.getTileX_ = function(scale, lam) {
  return Math.floor( scale * (lam - this.tileOrigin[0]) / this.rootTileSizeX );
};

TileManager.prototype.getTileY_ = function(scale, phi) {
  var sign = this.inverseY ? -1 : +1;
  return Math.floor( sign * scale * (phi - this.tileOrigin[1]) / this.rootTileSizeY );
};

TileManager.prototype.getTileNumX_ = function(scale) {
  return Math.ceil( scale * (this.tileDomain[2] - this.tileOrigin[0]) / this.rootTileSizeX );
};

TileManager.prototype.getTileNumY_ = function(scale) {
  var sign = this.inverseY ? -1 : +1;
  var phi = this.inverseY ? this.tileDomain[1] : this.tileDomain[3];
  return Math.ceil( sign * scale * (phi - this.tileOrigin[1]) / this.rootTileSizeY );
};

TileManager.prototype.getScale_ = function(level) {
  var p = Math.round(ProjMath.clamp(level, 0, this.numLevels-1));
  var s = (1 << p);
  return s;
};

/**
 *
 */
TileManager.prototype.getTileInfos = function(dataRect, level) {
  var scale = this.getScale_(level);
  var numX = this.getTileNumX_(scale);
  var idxX1 = this.getTileX_(scale, dataRect.lambda[0]);
  var idxX2 = this.getTileX_(scale, dataRect.lambda[1]);

  var numY = this.getTileNumY_(scale);
  var idxY1;
  var idxY2;
  if ( !this.inverseY ) {
    idxY1 = this.getTileY_(scale, dataRect.phi[0]);
    idxY2 = this.getTileY_(scale, dataRect.phi[1]);
  } else {
    idxY1 = this.getTileY_(scale, dataRect.phi[1]);
    idxY2 = this.getTileY_(scale, dataRect.phi[0]);
  }

  var ret = [];

  var iyMin = numY + 1;
  for ( var idxY = idxY1; idxY <= idxY2; ++idxY ) {
    var iy = idxY % numY;   //  正規化
    if ( iyMin == iy )   break;
    if ( iy < iyMin )    iyMin = iy;

    var ixMin = numX + 1;
    for ( var idxX = idxX1; idxX <= idxX2; ++idxX ) {
      var ix = idxX % numX;   //  正規化
      if ( ixMin == ix )   break;
      if ( ix < ixMin )   ixMin = ix;

      var str = this.tileUrlDef(level, ix, iy);
      var x1 = (this.rootTileSizeX * ix / scale) + this.tileOrigin[0];
      var x2 = (this.rootTileSizeX * (ix + 1) / scale) + this.tileOrigin[0];

      var y1;
      var y2;
      if ( !this.inverseY ) {
        y1 = (this.rootTileSizeY * iy / scale) + this.tileOrigin[1];
        y2 = (this.rootTileSizeY * (iy + 1) / scale) + this.tileOrigin[1];
      } else {
        y1 = (-this.rootTileSizeY * (iy + 1) / scale) + this.tileOrigin[1];
        y2 = (-this.rootTileSizeY * iy / scale) + this.tileOrigin[1];
      }

      var clipRect = null;
      if ( x1 < this.tileDomain[0] || y1 < this.tileDomain[1] || this.tileDomain[2] < x2 || this.tileDomain[3] < y2 ) {
        clipRect = [0.0, 0.0, 1.0, 1.0];
        if (x1 < this.tileDomain[0]) {
          clipRect[0] = (this.tileDomain[0] - x1) / (x2 - x1);
        }
        if (y1 < this.tileDomain[1]) {
          clipRect[1] = (this.tileDomain[1] - y1) / (y2 - y1);
        }
        if (this.tileDomain[2] < x2) {
          clipRect[2] = (this.tileDomain[2] - x1) / (x2 - x1);
        }
        if (this.tileDomain[3] < y2) {
          clipRect[3] = (this.tileDomain[3] - y1) / (y2 - y1);
        }
      }

      ret.push({
        url: str,
        rect: [x1, y1, x2, y2],
        clipRect: clipRect
      });
    }
  }
  return ret;
};

/* ------------------------------------------------------------ */

/**
 * 画像キャッシュ
 * @constructor
 */
var ImageCache = function(observer, cacheOpts) {
  this.num = 32;             //  default: 32
  this.crossOrigin = null;
  this.textures = {};
  this.loading = {};
  this.ongoingImageLoads = [];
  this.observer_ = observer;
  //
  if (typeof cacheOpts !== 'undefined') {
    if ('num' in cacheOpts) {
      this.num = cacheOpts.num;
    }
    if ('crossOrigin' in cacheOpts) {
      this.crossOrigin = cacheOpts.crossOrigin;
    }
  }
};


ImageCache.prototype.loadImage_ = function(gl, url, info) {
  this.loading[url] = true;
  var image = new Image();
  if ( this.crossOrigin != null ) {
    image.crossOrigin = this.crossOrigin;
  }
  image.onload = function() {
    this.ongoingImageLoads.splice(this.ongoingImageLoads.indexOf(image), 1);
    var tex = ImageUtils.createTexture(gl, image);
    if ( tex ) {
      this.textures[url] = [tex, info];
    }
    delete this.loading.url;
    this.observer_.call(this);
  }.bind(this);
  this.ongoingImageLoads.push(image);
  image.src = url;
};


ImageCache.prototype.loadImageIfAbsent = function(gl, url, info) {
  if ( url in this.textures )   return false;
  if ( url in this.loading )    return false;
  this.loadImage_(gl, url, info);
  return true;  //  ロード開始
};


ImageCache.prototype.getTexture = function(url) {
  var tex = this.textures[url];
  return tex;
};


ImageCache.prototype.clearOngoingImageLoads = function() {
  for (var i = 0; i < this.ongoingImageLoads.length; i++) {
    this.ongoingImageLoads[i].onload = undefined;
  }
  this.ongoingImageLoads = [];
};

/* ------------------------------------------------------------ */

/**
 * 直交座標系間の変換
 * @param {Array.<number>} srcCoordRect
 * @param {Array.<number>} dstCoordRect
 * @constructor
 */
var CoordTransform = function(srcCoordRect, dstCoordRect) {
  this.src_x1_ = srcCoordRect[0];
  this.src_y1_ = srcCoordRect[1];
  this.src_x2_ = srcCoordRect[2];
  this.src_y2_ = srcCoordRect[3];
  //
  this.dst_x1_ = dstCoordRect[0];
  this.dst_y1_ = dstCoordRect[1];
  this.dst_x2_ = dstCoordRect[2];
  this.dst_y2_ = dstCoordRect[3];
  //
  this.scaleX_ = (dstCoordRect[2] - dstCoordRect[0]) / (srcCoordRect[2] - srcCoordRect[0]);
  this.scaleY_ = (dstCoordRect[3] - dstCoordRect[1]) / (srcCoordRect[3] - srcCoordRect[1]);
};

CoordTransform.prototype.scaleX = function() {
  return this.scaleX_;
};

CoordTransform.prototype.scaleY = function() {
  return this.scaleY_;
};

CoordTransform.prototype.forwardPoint = function(srcPos) {
  var x = this.dst_x1_ + (srcPos[0] - this.src_x1_) * this.scaleX_;
  var y = this.dst_y1_ + (srcPos[1] - this.src_y1_) * this.scaleY_;
  return [x, y];
};


CoordTransform.prototype.forwardRect = function(srcRect) {
  var pt1 = this.forwardPoint([srcRect[0], srcRect[1]]);
  var pt2 = this.forwardPoint([srcRect[2], srcRect[3]]);
  return [pt1[0], pt1[1], pt2[0], pt2[1]];
};


/* ------------------------------------------------------------ */

var ViewWindowManager = function(viewRect, canvasSize, opts) {
  this.canvasSize = {width: canvasSize.width, height: canvasSize.height};
  //
  this.viewRect_ = viewRect;   //  投影後の全体領域, projに依存する定数
  this.zoomInLimit_ = null;
  this.zoomOutLimit_ = null;
  //
  if (typeof opts !== 'undefined') {
    if ('zoomInLimit' in opts) {
      this.zoomInLimit_ = opts.zoomInLimit;
    }
    if ('zoomOutLimit' in opts) {
      this.zoomOutLimit_ = opts.zoomOutLimit;
    }
  }
  //
  this.rect = this.getViewRect();
};

ViewWindowManager.prototype.setCanvasSize = function(canvasWidth, canvasHeight) {
  this.canvasSize.width = canvasWidth;
  this.canvasSize.height = canvasHeight;
};

ViewWindowManager.prototype.getCanvasSize = function() {
  return {width: this.canvasSize.width, height: this.canvasSize.height};  //  copy
};

ViewWindowManager.prototype.getViewRect = function() {
  return this.viewRect_.slice(0);  //  投影後の全体領域
};

ViewWindowManager.prototype.setViewWindow = function(x1, y1, x2, y2) {
  this.rect = [x1, y1, x2, y2];
};

ViewWindowManager.prototype.getViewWindow = function() {
  return this.rect.slice(0);   //  copy
};

ViewWindowManager.prototype.setViewWindowCenter = function(cx, cy) {
  var w = (this.rect[2] - this.rect[0]) / 2;
  var h = (this.rect[3] - this.rect[1]) / 2;
  this.rect = [cx-w, cy-h, cx+w, cy+h];
};

ViewWindowManager.prototype.getViewWindowCenter = function() {
  var x = (this.rect[2] + this.rect[0]) / 2;
  var y = (this.rect[3] + this.rect[1]) / 2;
  return [x, y];
};

ViewWindowManager.prototype.moveWindow = function(dx, dy) {
  var tx = - dx * (this.rect[2] - this.rect[0]) / this.canvasSize.width;
  var ty = dy * (this.rect[3] - this.rect[1]) / this.canvasSize.height;  //  画面座標の上下は逆
  var x1 = this.rect[0] + tx;
  var y1 = this.rect[1] + ty;
  var x2 = this.rect[2] + tx;
  var y2 = this.rect[3] + ty;
  this.rect = [x1, y1, x2, y2];
};

ViewWindowManager.prototype.zoomWindow = function(dz) {
  //  画面上でのY方向の長さをdzピクセル分だけ絞り込んだ部分の領域に拡大表示する。
  //  X方向はそれに合わせて等縮尺で拡大する。
  var s = (this.canvasSize.height - dz) / this.canvasSize.height;
  var w = s * (this.rect[2] - this.rect[0]) / 2;
  var h = s * (this.rect[3] - this.rect[1]) / 2;
  var cx = (this.rect[2] + this.rect[0]) / 2;
  var cy = (this.rect[3] + this.rect[1]) / 2;

  if ( this.zoomInLimit_ != null && (w < this.zoomInLimit_ || h < this.zoomInLimit_) )  return;
  if ( this.zoomOutLimit_ != null && (this.zoomOutLimit_ < w || this.zoomOutLimit_ < h) )  return;

  this.rect = [cx-w, cy-h, cx+w, cy+h];
};

ViewWindowManager.prototype.getViewPointFromWindow = function(x, y) {
  var trans = new CoordTransform([0, this.canvasSize.height, this.canvasSize.width, 0], this.rect);
  return trans.forwardPoint([x, y]);
};

/* ------------------------------------------------------------ */

/**
 * Map View
 * @param {object} gl
 * @param {object} ProjAEQD or ProjLAEA
 * @param {number} numLevels
 * @constructor
 */
var MapView = function(gl, proj, canvasSize, tileOpts, cacheOpts) {
  this.gl = gl;
  this.projection = proj;
  this.imageProj = RasterMapProjection.createShaderProgram(gl);
  this.imageProj.init(proj.getVertexShaderStr(), proj.getFragmentShaderStr());
  //
  var viewWindowOpts = {
    zoomInLimit: Math.PI / 20.0,
    zoomOutLimit: Math.PI * 20
  };
  var rangeRect = this.projection.getRange();
  this.viewWindowManager_ = new ViewWindowManager(rangeRect, canvasSize, viewWindowOpts);
  //
  this.layers_ = [];
  this.nameToLayers_ = {};
  //
  this.isValid_ = false;
};

MapView.prototype.setProjCenter = function(lam, phi) {
  this.projection.setProjCenter(lam, phi);
  this.imageProj.setProjCenter(lam, phi);
  this.invalidateLayers();
  this.invalidate();
};

MapView.prototype.getProjCenter = function() {
  return this.projection.getProjCenter();
};

MapView.prototype.getViewRect = function() {
  return this.viewWindowManager_.getViewRect();
};

MapView.prototype.getWindow = function() {
  return this.viewWindowManager_.getViewWindow();
};

MapView.prototype.setWindow = function(x1, y1, x2, y2) {
  this.viewWindowManager_.setViewWindow(x1, y1, x2, y2);
  this.invalidateLayers();
  this.invalidate();
};

MapView.prototype.moveWindow = function(dx, dy) {
  this.viewWindowManager_.moveWindow(dx, dy);
  this.invalidate();
};

MapView.prototype.zoomWindow = function(dz) {
  this.viewWindowManager_.zoomWindow(dz);
  this.invalidate();
};

MapView.prototype.getViewCenterPoint = function() {
  return this.viewWindowManager_.getViewWindowCenter();
};

MapView.prototype.setViewCenterPoint = function(cx, cy) {
  this.viewWindowManager_.setViewWindowCenter(cx, cy);
  this.invalidate();
};


MapView.prototype.getLambdaPhiPointFromWindow = function(x, y) {
  var viewPos = this.viewWindowManager_.getViewPointFromWindow(x, y);
  return this.projection.inverse(viewPos[0], viewPos[1]);
};

MapView.prototype.getViewPointFromWindow = function(x, y) {
  return this.viewWindowManager_.getViewPointFromWindow(x, y);
};

MapView.prototype.invalidate = function() {
  this.isValid_ = false;
};

MapView.prototype.invalidateLayers = function() {
  for (var j = 0; j < this.layers_.length; ++j) {
    this.layers_[j].invalidate();
  }
};

MapView.prototype.loadData = function() {
  for (var j = 0; j < this.layers_.length; ++j) {
    this.layers_[j].loadData(this);
  }
  this.invalidate();
};

MapView.prototype.createTexture = function(img) {
  return ImageUtils.createTexture(this.gl, img);
};

MapView.prototype.addLayer = function(layer) {
  this.layers_.push(layer);
  this.nameToLayers_[layer.layerId] = layer;
  this.invalidate();
};

MapView.prototype.clearLayers = function() {
  this.layers_.splice(0, this.layers_.length);
  this.nameToLayers_ = {};
  this.invalidate();
};

MapView.prototype.getLayerById = function(layerId) {
  return this.nameToLayers_[layerId];
};

MapView.prototype.render = function(force) {
  if ( force === true ) {
    for (var j = 0; j < this.layers_.length; ++j) {
      this.layers_[j].markInvalid();
    }
  } else if ( !this.requireRender_() ) {
    return false;
  }

  this.imageProj.clear(this.viewWindowManager_.canvasSize);

  var center = this.projection.getProjCenter();
  this.imageProj.setProjCenter(center.lambda, center.phi);

  var window = this.viewWindowManager_.getViewWindow();
  this.imageProj.setViewWindow(window[0], window[1], window[2], window[3]);

  //
  for (var k = 0; k < this.layers_.length; ++k) {
    if ( this.layers_[k].visibility ) {
      this.layers_[k].render(this);
    } else {
      this.layers_[k].markValid();
    }
  }

  this.isValid_ = true;
  return true;
};

MapView.prototype.requireRender_ = function() {
  if ( !this.isValid_ ) {
    return true;
  }
  for (var j = 0; j < this.layers_.length; ++j) {
    if ( !this.layers_[j].isValid() ) {
      return true;
    }
  }
  return false;
};

/* ------------------------------------------------------------ */

/**
 * Layer
 * @param {string} layerId
 * @param {number} coordType
 */
var Layer = function(layerId, coordType) {
  this.layerId = layerId;
  this.coordType = coordType;
  this.visibility = true;
  //
  this.isValid_ = false;
};

Layer.prototype.isValid = function() {
  return this.isValid_;
};

Layer.prototype.markInvalid = function() {
  this.isValid_ = false;
};

Layer.prototype.markValid = function() {
  this.isValid_ = true;
};

Layer.prototype.loadData = function(mapView) {
  //  default : empty
};

Layer.prototype.invalidate = function() {
  //  default : empty
  this.markInvalid();
};

Layer.prototype.setVisibility = function(visible) {
  this.visibility = visible;
  this.markInvalid();
};

Layer.prototype.render = function(mapView) {
  //  default : empty
  this.markValid();
};

/* ------------------------------------------------------------ */

/**
 * TileTextureLayer
 * @param {string} layerId
 * @param {number} coordType
 * @param {object} style (option)
 */
var TileTextureLayer = function(layerId, coordType, style, tileOpts, cacheOpts) {
  Layer.call(this, layerId, coordType);
  //
  this.tileManager = new TileManager(tileOpts);
  this.prevTileInfos_ = null;
  this.prevWindow_ = null;
  //
  var observer = function() {
    this.markInvalid();
  }.bind(this);
  this.imageCache = new ImageCache(observer, cacheOpts);
  //
  this.opacity = 1.0;
  if (typeof style !== 'undefined') {
    if ('opacity' in style) {
      this.opacity = style.opacity;
    }
  }
};
Object.setPrototypeOf(TileTextureLayer.prototype, Layer.prototype);

//  override
TileTextureLayer.prototype.invalidate = function() {
  this.clearTileInfoCache_();
  this.markInvalid();
};

//  override
TileTextureLayer.prototype.loadData = function(mapView) {
  if ( this.tileManager.tileUrlDef == null )   return -1;
  var tileInfos = this.getTileInfos_(mapView);
  var count = this.requestImages_(mapView.gl, tileInfos);
  this.markInvalid();
  return count;
};

TileTextureLayer.prototype.setTileUrlDef = function(tileUrlDef) {
  this.tileManager.tileUrlDef = tileUrlDef;
  this.markInvalid();
};

TileTextureLayer.prototype.setDataLevelDef = function(dataLevelDef) {
  this.tileManager.dataLevelDef = dataLevelDef;
  this.markInvalid();
};

TileTextureLayer.prototype.resetImages = function() {
  this.imageCache.clearOngoingImageLoads();
  this.markInvalid();
};

TileTextureLayer.prototype.render = function(mapView) {
  if ( this.tileManager.tileUrlDef == null )   return;
  var tileInfos = this.getTileInfos_(mapView);
  this.requestImages_(mapView.gl, tileInfos);

  var textures = [];
  for (var i = 0; i < tileInfos.length; ++i ) {
    var info = tileInfos[i];
    var tex = this.imageCache.getTexture(info.url);
    if ( tex ) {
      tex.push(info.clipRect);
      textures.push(tex);
    }
  }
  if ( 0 < textures.length ) {
    mapView.imageProj.setCoordTypeData();
    mapView.imageProj.setOpacity(this.opacity);
    mapView.imageProj.prepareRenderSurface();
    for (var k = 0; k < textures.length; k++ ) {
      var texId = textures[k][0];
      var rect = textures[k][1];
      var clip = textures[k][2];
      mapView.imageProj.renderSurfaceTexture(texId, rect, clip);
    }
  }
  //
  this.markValid();
};


TileTextureLayer.prototype.clearTileInfoCache_ = function() {
  this.prevWindow_ = null;
  this.prevTileInfos_ = null;
  this.markInvalid();
};

TileTextureLayer.prototype.requestImages_ = function(gl, tileInfos) {
  var count = 0;
  for (var i = 0; i < tileInfos.length; ++i ) {
    if ( this.imageCache.loadImageIfAbsent(gl, tileInfos[i].url, tileInfos[i].rect) ) {
      ++count;
    }
  }
  return count;
};

TileTextureLayer.prototype.getTileInfos_ = function(mapView) {
  var window = mapView.viewWindowManager_.getViewWindow();
  if ( this.prevTileInfos_ != null && this.prevWindow_ != null ) {
    if (window[0] == this.prevWindow_[0] && window[1] == this.prevWindow_[1] &&
      window[2] == this.prevWindow_[2] && window[3] == this.prevWindow_[3]) {
        return this.prevTileInfos_;
    }
    this.prevTileInfos_ = null;
    this.prevWindow_ = null;
  }
  var dataRect = mapView.projection.inverseBoundingBox(window[0], window[1], window[2], window[3]);
  var level = (this.tileManager.dataLevelDef != null) ? this.tileManager.dataLevelDef(window, dataRect) : 0;
  var tileInfos = this.tileManager.getTileInfos(dataRect, level);
  this.prevWindow_ = window;
  this.prevTileInfos_ = tileInfos;
  return tileInfos;
};

/* ------------------------------------------------------------ */

/**
 * PointTextureLayer
 * @param {string} layerId
 * @param {number} coordType
 * @param {textureId} pointTextureId
 * @param {object} style (option)
 */
var PointTextureLayer = function(layerId, coordType, pointTextureId, style) {
  Layer.call(this, layerId, coordType);
  this.pointTextureId = pointTextureId;
  //
  this.size = 48.0;
  //
  if (typeof style !== 'undefined') {
    if ('size' in style) {
      this.size = style.size;
    }
  }
  //
  this.data_ = [];
};
Object.setPrototypeOf(PointTextureLayer.prototype, Layer.prototype);

PointTextureLayer.prototype.addPoint = function(x, y) {
  this.data_.push(x, y);
  this.markInvalid();
};

PointTextureLayer.prototype.addPoints = function(points) {
  this.data_ = this.data_.concat(points);
  this.markInvalid();
};

PointTextureLayer.prototype.clear = function() {
  this.data_.splice(0, this.data_.length);
  this.markInvalid();
};

PointTextureLayer.prototype.render = function(mapView) {
  if ( 0 < this.data_.length ) {
    mapView.imageProj.prepareRenderPoints();
    mapView.imageProj.setCoordType(this.coordType);
    mapView.imageProj.setPointSize(this.size);
    mapView.imageProj.setPointTexture(this.pointTextureId);
    mapView.imageProj.renderPoints(this.data_);
  }
  //
  this.markValid();
};

/* ------------------------------------------------------------ */

/**
 * PolylineLayer
 * @param {string} layerId
 * @param {number} coordType
 * @param {object} style (option)
 */
var PolylineLayer = function(layerId, coordType, style) {
  Layer.call(this, layerId, coordType);
  //
  this.color = {r: 1.0, g: 1.0, b: 1.0, a: 1.0};
  //
  if (typeof style !== 'undefined') {
    if ('color' in style) {
      this.color = style.color;
    }
  }
  //
  this.data_ = [];
};
Object.setPrototypeOf(PolylineLayer.prototype, Layer.prototype);

PolylineLayer.prototype.addPolyline = function(polyline) {
  this.data_.push(polyline);
  this.markInvalid();
};

PolylineLayer.prototype.clear = function() {
  this.data_.splice(0, this.data_.length);
  this.markInvalid();
};

PolylineLayer.prototype.render = function(mapView) {
  if ( 0 < this.data_.length ) {
    mapView.imageProj.prepareRenderPolyline();
    mapView.imageProj.setCoordType(this.coordType);
    mapView.imageProj.setColor(this.color);
    for (var i = 0; i < this.data_.length; ++i) {
      mapView.imageProj.renderPolyline(this.data_[i]);
    }
  }
  //
  this.markValid();
};


/* ------------------------------------------------------------ */

/**
 * GraticuleLayer
 * @param {string} layerId
 * @param {number} coordType
 * @param {object} style (option)
 */
var GraticuleLayer = function(layerId, style) {
  Layer.call(this, layerId, ProjShaderProgram.COORD_TYPE_DATA);
  //
  this.graticuleRenderer_ = null;
  //
  this.color = {r: 0.88, g: 0.88, b: 0.88, a: 1.0};
  this.intervalDegrees = 20;   //  単位：度   0以下の場合は緯度経度線を描画しない
  //
  if (typeof style !== 'undefined') {
    if ('color' in style) {
      this.color = style.color;
    }
    if ('intervalDegrees' in style) {
      this.intervalDegrees = style.intervalDegrees;
    }
  }
};
Object.setPrototypeOf(GraticuleLayer.prototype, Layer.prototype);

GraticuleLayer.prototype.invalidate = function() {
  this.graticuleRenderer_ = null;
  this.markInvalid();
};

GraticuleLayer.prototype.render = function(mapView) {
  if ( 0 < this.intervalDegrees ) {
    if ( this.graticuleRenderer_ == null ) {
      this.graticuleRenderer_ = new GraticuleRenderer(mapView.imageProj, mapView.projection);
    }

    mapView.imageProj.setCoordTypeData();
    mapView.imageProj.setColor(this.color);
    //  TODO 効率化、リファクタリング
    var window = mapView.getWindow();
    var dataRect = mapView.projection.inverseBoundingBox(window[0], window[1], window[2], window[3]);
    this.graticuleRenderer_.renderLines(window, dataRect, this.intervalDegrees);
  }
  //
  this.markValid();
};

/* -------------------------------------------------------------------------- */
if (typeof module != 'undefined' && module.exports) {
  module.exports = MapView;
  module.exports.TileManager = TileManager;
}
