 /**
 * Raster Map Projection v0.0.13  2016-11-13
 * Copyright (C) 2016 T.Seno
 * All rights reserved.
 * @license GPL v3 License (http://www.gnu.org/licenses/gpl.html)
 */
'use strict';

if (typeof module!='undefined' && module.exports) {
  var ProjMath = require('./rasterproj-common.js');
}



/**
 * ラスタタイル情報管理
 * @param {number} rootNumX
 * @param {number} rootNumY
 * @param {number} numLevels
 * @constructor
 */
var TileManager = function(tile_opts) {
  this.rootNumX = 2;
  this.rootNumY = 1;
  this.rootTileSizeX = Math.PI;
  this.rootTileSizeY = Math.PI;
  this.numLevels = 1;
  this.inverseY = false;
  this.tileOrigin = [ -Math.PI, -Math.PI/2 ];     // lower left
  //
  if (typeof tile_opts !== 'undefined') {
    if ('rootNumX' in tile_opts) {
      this.rootNumX = tile_opts.rootNumX;
    }
    if ('rootNumY' in tile_opts) {
      this.rootNumY = tile_opts.rootNumY;
    }
    if ('rootTileSizeX' in tile_opts) {
      this.rootTileSizeX = tile_opts.rootTileSizeX;
    }
    if ('tileSizeY' in tile_opts) {
      this.rootTileSizeY = tile_opts.rootTileSizeY;
    }
    if ('numLevels' in tile_opts) {
      this.numLevels = tile_opts.numLevels;
    }
    if ('inverseY' in tile_opts) {
      this.inverseY = tile_opts.inverseY;   //  TODO booleanへの型変換
    }
    if ('tileOrigin' in tile_opts) {
      this.tileOrigin = tile_opts.tileOrigin;   //  TODO Array型チェック!!
    }
  }
  //
  this.rootSizeX = this.rootNumX * this.rootTileSizeX;
  this.rootSizeY = this.rootNumY * this.rootTileSizeY;
};

TileManager.prototype.getTileX_ = function(numX, lam) {
  return Math.floor( numX * (lam - this.tileOrigin[0]) / this.rootSizeX );
};

TileManager.prototype.getTileY_ = function(numY, phi) {
  var sign = this.inverseY ? -1 : +1;
  return Math.floor( sign * numY * (phi - this.tileOrigin[1]) / this.rootSizeY );
};

TileManager.prototype.getTileNum_ = function(level) {
  var p = Math.round(ProjMath.clamp(level, 0, this.numLevels-1));
  var s = (1 << p);
  return [ s * this.rootNumX, s * this.rootNumY ];
};


/**
 * getUrl : function(level, ix, iy) -> URL
 */
TileManager.prototype.getTileInfos = function(lamRange, phiRange, level, getUrl) {
  var tileNum = this.getTileNum_(level);
  var numX = tileNum[0];
  var numY = tileNum[1];
  var idxX1 = this.getTileX_(numX, lamRange[0]);
  var idxX2 = this.getTileX_(numX, lamRange[1]);

  var idxY1, idxY2;
  if ( !this.inverseY ) {
    idxY1 = this.getTileY_(numY, phiRange[0]);
    idxY2 = this.getTileY_(numY, phiRange[1]);
  } else {
    idxY1 = this.getTileY_(numY, phiRange[1]);
    idxY2 = this.getTileY_(numY, phiRange[0]);
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

      var str = getUrl(level, ix, iy);
      var x1 = (this.rootSizeX * ix / numX) + this.tileOrigin[0];
      var x2 = (this.rootSizeX * (ix + 1) / numX) + this.tileOrigin[0];

      var y1, y2;
      if ( !this.inverseY ){
        y1 = (this.rootSizeY * iy / numY) + this.tileOrigin[1];
        y2 = (this.rootSizeY * (iy + 1) / numY) + this.tileOrigin[1];
      } else {
        y1 = (-this.rootSizeY * (iy + 1) / numY) + this.tileOrigin[1];
        y2 = (-this.rootSizeY * iy / numY) + this.tileOrigin[1];
      }
      ret.push({
        url: str,
        rect: [x1, y1, x2, y2]
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
var ImageCache = function(cache_opts) {
  this.num = 32;             //  default: 32
  this.crossOrigin = null;
  this.textures = {};
  this.loading = {};
  this.ongoingImageLoads = [];
  //
  if (typeof cache_opts !== 'undefined') {
    if ('num' in cache_opts) {
      this.num = cache_opts.num;
    }
    if ('crossOrigin' in cache_opts) {
      this.crossOrigin = cache_opts.crossOrigin;
    }
  }
  //
  this.createTexture = null;
};


ImageCache.prototype.loadImage_ = function(url, info) {
  this.loading[url] = true;
  var image = new Image();
  if ( this.crossOrigin != null ) {
    image.crossOrigin = this.crossOrigin;
  }
  var cache = this;
  image.onload = function() {
    cache.ongoingImageLoads.splice(cache.ongoingImageLoads.indexOf(image), 1);
    if ( cache.createTexture == null )   return;
    var tex = cache.createTexture(image);
    if ( tex ) {
      cache.textures[url] = [ tex, info ];
    }
    delete cache.loading.url;
  };
  this.ongoingImageLoads.push(image);
  image.src = url;
};


ImageCache.prototype.loadImageIfAbsent = function(url, info) {
  if ( url in this.textures )   return false;
  if ( url in this.loading )    return false;
  this.loadImage_(url, info);
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
 * @param {Array.<number>} src_coord_rect
 * @param {Array.<number>} dst_coord_rect
 * @constructor
 */
var CoordTransform = function(src_coord_rect, dst_coord_rect) {
  this.src_x1_ = src_coord_rect[0];
  this.src_y1_ = src_coord_rect[1];
  this.src_x2_ = src_coord_rect[2];
  this.src_y2_ = src_coord_rect[3];
  //
  this.dst_x1_ = dst_coord_rect[0];
  this.dst_y1_ = dst_coord_rect[1];
  this.dst_x2_ = dst_coord_rect[2];
  this.dst_y2_ = dst_coord_rect[3];
  //
  this.scaleX_ = (dst_coord_rect[2] - dst_coord_rect[0]) / (src_coord_rect[2] - src_coord_rect[0]);
  this.scaleY_ = (dst_coord_rect[3] - dst_coord_rect[1]) / (src_coord_rect[3] - src_coord_rect[1]);
};

CoordTransform.prototype.scaleX = function() {
  return this.scaleX_;
};

CoordTransform.prototype.scaleY = function() {
  return this.scaleY_;
};

CoordTransform.prototype.forwardPoint = function(src_pos) {
  var x = this.dst_x1_ + (src_pos[0] - this.src_x1_) * this.scaleX_;
  var y = this.dst_y1_ + (src_pos[1] - this.src_y1_) * this.scaleY_;
  return [x, y];
};


CoordTransform.prototype.forwardRect = function(src_rect) {
  var pt1 = this.forwardPoint([src_rect[0], src_rect[1]]);
  var pt2 = this.forwardPoint([src_rect[2], src_rect[3]]);
  return [pt1[0], pt1[1], pt2[0], pt2[1]];
};


/* ------------------------------------------------------------ */

var ViewWindowManager = function(viewRect, canvasSize, opts) {
  this.canvasSize = { width: canvasSize.width, height: canvasSize.height };  //  TODO assert?
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
  return { width: this.canvasSize.width, height: this.canvasSize.height };  //  copy
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
  this.rect = [ cx-w, cy-h, cx+w, cy+h ];
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
  this.rect = [ x1, y1, x2, y2 ];
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

  this.rect = [ cx-w, cy-h, cx+w, cy+h ];
};

ViewWindowManager.prototype.getViewPointFromWindow = function(x, y) {
  var trans = new CoordTransform([0, this.canvasSize.height, this.canvasSize.width, 0], this.rect);
  return trans.forwardPoint([x, y]);
};

ViewWindowManager.prototype.getNormalizedSize = function(size) {
  return { width: size.width / this.canvasSize.width, height: size.height / this.canvasSize.height };
};

/**
 * 長辺を1となるように正規化されたCanvasの矩形を取得する。
 * TRIANGLE_STRIPの形式の点列とする。
 */
ViewWindowManager.prototype.getNormalizedRectAsTriangleStrip = function() {
  var sx = 0.5;
  var sy = 0.5;
  if ( this.canvasSize.width < this.canvasSize.width ) {
    sy = 0.5 * this.canvasSize.height / this.canvasSize.width;
  } else if ( this.canvasSize.width < this.canvasSize.height ) {
    sx = 0.5 * this.canvasSize.width / this.canvasSize.height;
  }
  return new Float32Array([
    0.5-sx, 0.5-sy,   // left top
    0.5-sx, 0.5+sy,   // left bottom
    0.5+sx, 0.5-sy,   // right top
    0.5+sx, 0.5+sy    // right bottom
  ]);
};

/* ------------------------------------------------------------ */

/**
 * Map View
 * @param {object} gl
 * @param {object} RasterProjAEQD or RasterProjLAEA
 * @param {number} numLevels
 * @constructor
 */
var MapView = function(gl, imgProj, canvasSize, tile_opts, cache_opts) {
  this.gl = gl;
  this.imageProj = imgProj;
  //
  var viewWindowOpts = {
    zoomInLimit: Math.PI / 20.0,
    zoomOutLimit: Math.PI * 20
  };
  var rangeRect = this.imageProj.projection.getRange();
  this.viewWindowManager_ = new ViewWindowManager(rangeRect, canvasSize, viewWindowOpts);
  //
  this.tileManager = new TileManager(tile_opts);
  this.prevTileInfos_ = null;
  this.prevWindow_ = null;
  //
  this.imageCache = new ImageCache(cache_opts);
  var self = this;
  this.imageCache.createTexture = function(img) {
    return self.createTexture(img);
  };
  //
  this.centerIcon_ = null;
  this.centerIconSize_ = null;  //  iconSize: { width:, height: } [pixel]
  //
  this.graticuleInterval = 20;   //  0以下の場合は緯度経度線を描画しない
  this.createUrl = null;
  this.calculateLevel = null;
};

MapView.prototype.clearTileInfoCache_ = function() {
  this.prevWindow_ = null;
  this.prevTileInfos_ = null;
};

MapView.prototype.setCenterIcon = function(iconTexture, size) {
  this.centerIcon_ = iconTexture;
  this.centerIconSize_ = size;
};

MapView.prototype.setProjCenter = function(lam, phi) {
  this.clearTileInfoCache_();
  this.imageProj.setProjCenter(lam, phi);
};

MapView.prototype.getProjCenter = function() {
  return this.imageProj.projection.getProjCenter();
};

MapView.prototype.getViewRect = function() {
  return this.viewWindowManager_.getViewRect();
};

MapView.prototype.setWindow = function(x1, y1, x2, y2) {
  this.clearTileInfoCache_();
  this.viewWindowManager_.setViewWindow(x1, y1, x2, y2);
};

MapView.prototype.moveWindow = function(dx, dy) {
  this.viewWindowManager_.moveWindow(dx, dy);
};

MapView.prototype.zoomWindow = function(dz) {
  this.viewWindowManager_.zoomWindow(dz);
};

MapView.prototype.getViewCenterPoint = function() {
  return this.viewWindowManager_.getViewWindowCenter();
};

MapView.prototype.setViewCenterPoint = function(cx, cy) {
  this.viewWindowManager_.setViewWindowCenter(cx, cy);
};


MapView.prototype.getLambdaPhiPointFromWindow = function(x, y) {
  var viewPos = this.viewWindowManager_.getViewPointFromWindow(x, y);
  return this.imageProj.projection.inverse(viewPos[0], viewPos[1]);
};


MapView.prototype.resetImages = function() {
  this.imageCache.clearOngoingImageLoads();
};


MapView.prototype.requestImagesIfNecessary = function() {
  if ( this.createUrl == null )   return -1;
  var tileInfos = this.getTileInfos_();
  var count = this.requestImages_(tileInfos);
  return count;
};


MapView.prototype.render = function() {
  if ( this.createUrl == null )   return;
  var tileInfos = this.getTileInfos_();
  this.requestImages_(tileInfos);
  this.render_(tileInfos);
};

//  TODO この実装の詳細は別の場所にあるべきか
MapView.prototype.createTexture = function(img) {
  var tex = this.gl.createTexture();
  this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
  this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

  this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
  this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, img);

  this.gl.bindTexture(this.gl.TEXTURE_2D, null);
  return tex;
};


MapView.prototype.getTileInfos_ = function() {
  var window = this.viewWindowManager_.getViewWindow();
  if ( this.prevTileInfos_ != null && this.prevWindow_ != null ) {
    if (window[0] == this.prevWindow_[0] && window[1] == this.prevWindow_[1] &&
      window[2] == this.prevWindow_[2] && window[3] == this.prevWindow_[3]) {
        return this.prevTileInfos_;  //  TODO clone?
    }
    this.prevTileInfos_ = null;
    this.prevWindow_ = null;
  }
  var dataRect = this.imageProj.projection.inverseBoundingBox(window[0], window[1], window[2], window[3]);
  var level = (this.calculateLevel != null) ? this.calculateLevel(window, dataRect) : 0;
  var tileInfos = this.tileManager.getTileInfos(dataRect.lambda, dataRect.phi, level, this.createUrl);
  this.prevWindow_ = window;
  this.prevTileInfos_ = tileInfos;
  return tileInfos;
};


MapView.prototype.requestImages_ = function(tileInfos) {
  var count = 0;
  for (var i = 0; i < tileInfos.length; ++i ) {
    if ( this.imageCache.loadImageIfAbsent(tileInfos[i].url, tileInfos[i].rect) ) {
      ++count;
    }
  }
  return count;
};


MapView.prototype.render_ = function(tileInfos) {
  this.imageProj.clear(this.viewWindowManager_.canvasSize);
  var targetTextures = [];
  for (var i = 0; i < tileInfos.length; ++i ) {
    var info = tileInfos[i];
    var tex = this.imageCache.getTexture(info.url);
    if ( tex ) {
      targetTextures.push(tex);
    }
  }

  var texCoords = this.viewWindowManager_.getNormalizedRectAsTriangleStrip();
  this.imageProj.prepareRender(texCoords, this.viewWindowManager_.rect);
  if ( 0 < targetTextures.length ) {
    this.imageProj.renderTextures(targetTextures);
  }
  if ( 0 < this.graticuleInterval ) {
    this.imageProj.renderGraticule(this.viewWindowManager_.rect, this.graticuleInterval);
  }
  //
  if ( this.centerIcon_ ) {
    var iconSize = this.viewWindowManager_.getNormalizedSize(this.centerIconSize_);
    this.imageProj.prepareRender(texCoords, this.viewWindowManager_.rect);
    this.imageProj.renderOverlays(this.centerIcon_, iconSize);
  }
};


/* -------------------------------------------------------------------------- */
if (typeof module != 'undefined' && module.exports) {
  module.exports = MapView;
  module.exports.TileManager = TileManager;
}
