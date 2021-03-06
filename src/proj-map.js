/**
 * Raster Map Projection v0.0.29  2019-06-02
 * Copyright (C) 2016-2019 T.Seno
 * All rights reserved.
 * @license GPL v3 License (http://www.gnu.org/licenses/gpl.html)
 */
'use strict';

if (typeof module!='undefined' && module.exports) {
  var RasterProjCommon = require('./rasterproj-common.js');
  var LambdaRangeUtils = RasterProjCommon.LambdaRangeRectUtils;
  var GeographicRectUtils = RasterProjCommon.GeographicRectUtils;
  var ProjMath = RasterProjCommon.ProjMath;
}

// -----------------------------------------------------

/**
 * ラスタタイル情報管理
 * @param {number} rootNumX
 * @param {number} rootNumY
 * @param {number} numLevels
 * @constructor
 */
function TileManager(tileOpts) {
  this.rootNumX = 2;
  this.rootNumY = 1;
  this.rootTileSizeX = Math.PI;
  this.rootTileSizeY = Math.PI;
  this.numLevels = 1;
  this.inverseY = false;
  this.tileOrigin = [-Math.PI, -Math.PI/2];     // lower left
  //
  this.tileDomain = { lambda1:-Math.PI, phi1:-Math.PI/2, lambda2:+Math.PI, phi2:+Math.PI/2 };   //  タイル領域全体
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
}

TileManager.prototype.getTileX_ = function(scale, lam) {
  return Math.floor( scale * (lam - this.tileOrigin[0]) / this.rootTileSizeX );
};

TileManager.prototype.getTileY_ = function(scale, phi) {
  const sign = this.inverseY ? -1 : +1;
  return Math.floor( sign * scale * (phi - this.tileOrigin[1]) / this.rootTileSizeY );
};

TileManager.prototype.getTileNumX_ = function(scale) {
  return Math.ceil( scale * (this.tileDomain.lambda2 - this.tileOrigin[0]) / this.rootTileSizeX );
};

TileManager.prototype.getTileNumY_ = function(scale) {
  const sign = this.inverseY ? -1 : +1;
  const phi = this.inverseY ? this.tileDomain.phi1 : this.tileDomain.phi2;
  return Math.ceil( sign * scale * (phi - this.tileOrigin[1]) / this.rootTileSizeY );
};

TileManager.prototype.getScale_ = function(level) {
  const p = Math.round(ProjMath.clamp(level, 0, this.numLevels-1));
  const s = (1 << p);
  return s;
};

/**
 *
 */
TileManager.prototype.getTileInfos = function(dataRect, level) {
  const scale = this.getScale_(level);
  const numX = this.getTileNumX_(scale);
  const lams = LambdaRangeUtils.normalize({ min:dataRect.lambda1, max:dataRect.lambda2 });
  const idxX1 = this.getTileX_(scale, lams.min);
  const idxX2 = this.getTileX_(scale, lams.max);

  const numY = this.getTileNumY_(scale);
  let idxY1;
  let idxY2;
  if ( !this.inverseY ) {
    idxY1 = this.getTileY_(scale, dataRect.phi1);
    idxY2 = this.getTileY_(scale, dataRect.phi2);
  } else {
    idxY1 = this.getTileY_(scale, dataRect.phi2);
    idxY2 = this.getTileY_(scale, dataRect.phi1);
  }

  const ret = [];

  let iyMin = numY + 1;
  for ( let idxY = idxY1; idxY <= idxY2; ++idxY ) {
    const iy = idxY % numY;   //  正規化    //  TODO idxYの正規化は不要？
    if ( iyMin == iy )   break;
    if ( iy < iyMin )    iyMin = iy;

    let ixMin = numX + 1;
    for ( let idxX = idxX1; idxX <= idxX2; ++idxX ) {
      const ix = idxX % numX;   //  正規化
      if ( ixMin == ix )   break;
      if ( ix < ixMin )   ixMin = ix;

      const str = this.tileUrlDef(level, ix, iy);
      const x1 = (this.rootTileSizeX * ix / scale) + this.tileOrigin[0];
      const x2 = (this.rootTileSizeX * (ix + 1) / scale) + this.tileOrigin[0];

      let y1;
      let y2;
      if ( !this.inverseY ) {
        y1 = (this.rootTileSizeY * iy / scale) + this.tileOrigin[1];
        y2 = (this.rootTileSizeY * (iy + 1) / scale) + this.tileOrigin[1];
      } else {
        y1 = (-this.rootTileSizeY * (iy + 1) / scale) + this.tileOrigin[1];
        y2 = (-this.rootTileSizeY * iy / scale) + this.tileOrigin[1];
      }

      let clipRect = null;
      if ( x1 < this.tileDomain.lambda1 || y1 < this.tileDomain.phi1 || this.tileDomain.lambda2 < x2 || this.tileDomain.phi2 < y2 ) {
        clipRect = { x1:0.0, y1:0.0, x2:1.0, y2:1.0 };
        if (x1 < this.tileDomain.lambda1) {
          clipRect.x1 = (this.tileDomain.lambda1 - x1) / (x2 - x1);
        }
        if (y1 < this.tileDomain.phi1) {
          clipRect.y1 = (this.tileDomain.phi1 - y1) / (y2 - y1);
        }
        if (this.tileDomain.lambda2 < x2) {
          clipRect.x2 = (this.tileDomain.lambda2 - x1) / (x2 - x1);
        }
        if (this.tileDomain.phi2 < y2) {
          clipRect.y2 = (this.tileDomain.phi2 - y1) / (y2 - y1);
        }
      }

      ret.push({
        url: str,
        rect: { lambda1:x1, phi1:y1, lambda2:x2, phi2:y2 },   //  Data Coords
        clipRect: clipRect     //  Screen Coords
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
function ImageCache(observer, cacheOpts) {
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
}


ImageCache.prototype.loadImage_ = function(gl, url, info) {
  this.loading[url] = true;
  const image = new Image();
  if ( this.crossOrigin != null ) {
    image.crossOrigin = this.crossOrigin;
  }
  image.onload = function() {
    this.ongoingImageLoads.splice(this.ongoingImageLoads.indexOf(image), 1);
    const tex = ImageUtils.createTexture(gl, image);
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
  const tex = this.textures[url];
  return tex;
};


ImageCache.prototype.clearOngoingImageLoads = function() {
  for (let i = 0; i < this.ongoingImageLoads.length; i++) {
    this.ongoingImageLoads[i].onload = undefined;
  }
  this.ongoingImageLoads = [];
};

/* ------------------------------------------------------------ */

/**
 * 回転を含む座標系間の変換
 */
function CoordTransform(cxx, cxy, cyx, cyy, tx, ty) {
  this.cxx_ = cxx;
  this.cxy_ = cxy;
  this.cyx_ = cyx;
  this.cyy_ = cyy;
  this.tx_  = tx;
  this.ty_  = ty;
}

CoordTransform.prototype.clone = function() {
  return new CoordTransform(this.cxx_, this.cxy_, this.cyx_, this.cyy_, this.tx_, this.ty_);
};

CoordTransform.prototype.equals = function(dst) {
  return (this.cxx_ === dst.cxx_) &&
    (this.cxy_ === dst.cxy_) &&
    (this.cyx_ === dst.cyx_) &&
    (this.cyy_ === dst.cyy_) &&
    (this.tx_ === dst.tx_) &&
    (this.ty_ === dst.ty_);
};

CoordTransform.prototype.forwardPoint = function(x, y) {
  const dstX = this.cxx_ * x + this.cxy_ * y + this.tx_;
  const dstY = this.cyx_ * x + this.cyy_ * y + this.ty_;
  return [dstX, dstY];
};

/**
 * @param {Rectangle} rect
 */
CoordTransform.prototype.forwardRectBounds = function(rect) {
  let xmin, xmax, ymin, ymax;
  if (rect.x1 < rect.x2) {
    xmin = rect.x1;
    xmax = rect.x2;
  } else {
    xmin = rect.x2;
    xmax = rect.x1;
  }
  if (rect.y1 < rect.y2) {
    ymin = rect.y1;
    ymax = rect.y2;
  } else {
    ymin = rect.y2;
    ymax = rect.y1;
  }

  let dstX1, dstX2, dstY1, dstY2;
  dstX1 = dstX2 = this.tx_;
  dstY1 = dstY2 = this.ty_;
  if (0.0 <= this.cxx_) {
    dstX1 += this.cxx_ * xmin;
    dstX2 += this.cxx_ * xmax;
  } else {
    dstX1 += this.cxx_ * xmax;
    dstX2 += this.cxx_ * xmin;
  }
  if (0.0 <= this.cxy_) {
    dstX1 += this.cxy_ * ymin;
    dstX2 += this.cxy_ * ymax;
  } else {
    dstX1 += this.cxy_ * ymax;
    dstX2 += this.cxy_ * ymin;
  }
  if (0.0 <= this.cyx_) {
    dstY1 += this.cyx_ * xmin;
    dstY2 += this.cyx_ * xmax;
  } else {
    dstY1 += this.cyx_ * xmax;
    dstY2 += this.cyx_ * xmin;
  }
  if (0.0 <= this.cyy_) {
    dstY1 += this.cyy_ * ymin;
    dstY2 += this.cyy_ * ymax;
  } else {
    dstY1 += this.cyy_ * ymax;
    dstY2 += this.cyy_ * ymin;
  }
  return { x1:dstX1, y1:dstY1, x2:dstX2, y2:dstY2 };
};


/* ------------------------------------------------------------ */

/**
 * ViewWindowManager
 * @param {Rectangle} viewRect
 * @param {Size} canvasSize
 * @param {Object} opts
 */
function ViewWindowManager(viewRect, canvasSize, opts) {
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
  const cx = (this.viewRect_.x2 + this.viewRect_.x1) / 2;
  const cy = (this.viewRect_.y2 + this.viewRect_.y1) / 2;
  const w = (this.viewRect_.x2 - this.viewRect_.x1);
  const h = (this.viewRect_.y2 - this.viewRect_.y1);
  this.viewCenter = [cx, cy];
  this.viewWindowSize = { width:w, height:h };
  //
  this.rot_ = null;
  this.setRotate(0.0);   //  ViewとWindow間の回転角
  this.transform_ = this.calcTransform_();
}

ViewWindowManager.prototype.calcTransform_ = function() {
  const cx = this.viewCenter[0];
  const cy = this.viewCenter[1];
  const dx = this.viewWindowSize.width / 2.0;
  const dy = this.viewWindowSize.height / 2.0;
  const sx = this.viewWindowSize.width / this.canvasSize.width;
  const sy = this.viewWindowSize.height / this.canvasSize.height;

  const cxx =  this.rot_.cost*sx;
  const cxy = -this.rot_.sint*sy;
  const tx  = cx - this.rot_.cost*dx - this.rot_.sint*dy + this.rot_.sint*sy * this.canvasSize.height;

  const cyx = -this.rot_.sint*sx;
  const cyy = -this.rot_.cost*sy;
  const ty  = cy + this.rot_.sint*dx - this.rot_.cost*dy + this.rot_.cost*sy * this.canvasSize.height;

  return new CoordTransform(cxx, cxy, cyx, cyy, tx, ty);
};

ViewWindowManager.prototype.setRotate = function(theta) {
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  this.rot_ = { theta: theta, cost: ct, sint: st };
  this.transform_ = this.calcTransform_();
};

ViewWindowManager.prototype.getRotate = function() {
  return this.rot_.theta;
};

ViewWindowManager.prototype.rotate = function(dt) {
  const theta = this.rot_.theta + dt;
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  //
  const cosdt = Math.cos(dt);
  const sindt = Math.sin(dt);
  const dstX =  this.viewCenter[0] * cosdt + this.viewCenter[1] * sindt;
  const dstY = -this.viewCenter[0] * sindt + this.viewCenter[1] * cosdt;
  //
  this.viewCenter = [dstX, dstY];
  this.rot_ = { theta: theta, cost: ct, sint: st };
  this.transform_ = this.calcTransform_();
};

/**
 * @param {Size} size canvas size
 */
ViewWindowManager.prototype.setCanvasSize = function(size) {
  this.canvasSize = Object.assign({}, size);
  this.transform_ = this.calcTransform_();
};

/**
 * @return {Size} canvas size
 */
ViewWindowManager.prototype.getCanvasSize = function() {
  return Object.assign({}, this.canvasSize);
};

/**
 * @return {Rectangle} view rectangle
 */
ViewWindowManager.prototype.getViewRect = function() {
  return Object.assign({}, this.viewRect_);  //  投影後の全体領域
};

//  MEMO setViewWindowに代わるメソッド
ViewWindowManager.prototype.setViewWindowByCenter = function(viewCenter, viewSize) {
  this.viewCenter = viewCenter.slice(0);
  this.viewWindowSize = Object.assign({}, viewSize);
  this.transform_ = this.calcTransform_();
};

//  MEMO deprecatedを検討 -> 回転無しでViewWindowの設定
/**
 * @param {Rectangle} rect
 */
ViewWindowManager.prototype.setViewWindow = function(rect) {
  this.viewCenter = RectangleUtils.getCenter(rect);
  this.viewWindowSize = RectangleUtils.getSize(rect);
  this.setRotate(0);   //  this.calcTransform_() はsetRotate(0)内で実施しているため不要
};

//  MEMO このAPI単体としては対応済み（ただし確認が不十分）
ViewWindowManager.prototype.getViewWindowBounds = function() {
  return this.transform_.forwardRectBounds({ x1:0, y1:0, x2:this.canvasSize.width, y2:this.canvasSize.height });
};

ViewWindowManager.prototype.getViewWindowScale = function() {
  return Math.sqrt(this.viewWindowSize.width * this.viewWindowSize.width + this.viewWindowSize.height * this.viewWindowSize.height);
};

//  TODO 動作確認が必要
//   Window座標系上の矩形のView座標系上のBoundingBox取得
ViewWindowManager.prototype.getViewRectBoundsFromWindow = function(rect) {
  return this.transform_.forwardRectBounds(rect);
};

//  MEMO 対応済み
ViewWindowManager.prototype.setViewWindowCenter = function(cx, cy) {
  this.viewCenter = [cx, cy];
  this.transform_ = this.calcTransform_();
};

//  MEMO 対応済み
ViewWindowManager.prototype.getViewWindowCenter = function() {
  return this.viewCenter.slice(0);
};

//  MEMO 対応済み、回転への再調整済み
ViewWindowManager.prototype.moveWindow = function(dx, dy) {
  const sx = this.viewWindowSize.width / this.canvasSize.width;
  const sy = this.viewWindowSize.height / this.canvasSize.height;  //  画面座標の上下は逆
  const cx = this.viewCenter[0] - sx*this.rot_.cost*dx + sy*this.rot_.sint*dy;
  const cy = this.viewCenter[1] + sx*this.rot_.sint*dx + sy*this.rot_.cost*dy;  //  画面座標の上下は逆
  this.viewCenter = [cx, cy];
  this.transform_ = this.calcTransform_();
};

//  MEMO 対応済み
ViewWindowManager.prototype.zoomWindow = function(dz) {
  //  画面上でのY方向の長さをdzピクセル分だけ絞り込んだ部分の領域に拡大表示する。
  //  X方向はそれに合わせて等縮尺で拡大する。
  const s = (this.canvasSize.height - dz) / this.canvasSize.height;
  const w2 = s * this.viewWindowSize.width / 2;
  const h2 = s * this.viewWindowSize.height / 2;

  if ( this.zoomInLimit_ != null && (w2 < this.zoomInLimit_ || h2 < this.zoomInLimit_) )  return;
  if ( this.zoomOutLimit_ != null && (this.zoomOutLimit_ < w2 || this.zoomOutLimit_ < h2) )  return;

  this.viewWindowSize = { width: 2 * w2, height: 2 * h2 };
  this.transform_ = this.calcTransform_();
};

//  MEMO 対応済み
ViewWindowManager.prototype.getViewPointFromWindow = function(x, y) {
  return this.transform_.forwardPoint(x, y);
};

/* ------------------------------------------------------------ */

/**
 * MapViewにおいてデータ座標系上のBoundingRectを算出する際の計算の効率化の判定処理
 */
function GeographicRectBoundsCalculateStrategy_(theta0) {
  this.theta0_ = theta0;
}

GeographicRectBoundsCalculateStrategy_.prototype.calculate = function(theta) {
  const t = theta - Math.floor(theta * 2/Math.PI) * Math.PI/2;
  if (t < this.theta0_ || Math.PI/2 - this.theta0_ < t) {
    return 1;
  }
  return 2;
};

/* ------------------------------------------------------------ */

/**
 * Map View
 *
 * @param {ProjShaderProgram} imageProj
 * @param {Projection} ProjAEQD or ProjLAEA
 * @param {number} numLevels
 * @constructor
 */
function MapView(imageProj, proj, canvasSize) {
  this.imageProj = imageProj;
  this.projection = proj;
  //
  const viewWindowOpts = {
    zoomInLimit: Math.PI / 20.0,
    zoomOutLimit: Math.PI * 20
  };
  const rangeRect = this.projection.getRange();
  this.viewWindowManager_ = new ViewWindowManager(rangeRect, canvasSize, viewWindowOpts);
  //
  this.calcStrategy_ = new GeographicRectBoundsCalculateStrategy_(Math.PI/16);
  //
  this.layers_ = [];
  this.nameToLayers_ = {};
  //
  this.isValid_ = false;
}

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

MapView.prototype.getRotate = function() {
  return this.viewWindowManager_.getRotate();
};

MapView.prototype.setRotate = function(theta) {
  this.viewWindowManager_.setRotate(theta);
  this.invalidate();
};

MapView.prototype.rotate = function(dt) {
  this.viewWindowManager_.rotate(dt);
  this.invalidate();
};

MapView.prototype.getWindowBounds = function() {
  return this.viewWindowManager_.getViewWindowBounds();
};

//  MEMO deprecatedを検討 -> 回転無しでViewWindowの設定
/**
 * @param {Rectangle} rect
 */
MapView.prototype.setWindow = function(rect) {
  this.viewWindowManager_.setViewWindow(rect);
  this.invalidateLayers();
  this.invalidate();
};

//  MEMO 中心点とサイズでの指定
MapView.prototype.setWindowByCenter = function(viewCenter, viewSize) {
  this.viewWindowManager_.setViewWindowByCenter(viewCenter, viewSize);
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

//  TODO getDataPointFromWindow等に名称変更を検討
MapView.prototype.getLambdaPhiPointFromWindow = function(x, y) {
  const viewPos = this.viewWindowManager_.getViewPointFromWindow(x, y);
  return this.projection.inverse(viewPos[0], viewPos[1]);
};

MapView.prototype.getViewPointFromWindow = function(x, y) {
  return this.viewWindowManager_.getViewPointFromWindow(x, y);
};

//  TODO リファクタリング
MapView.prototype.getDividedGeographicRectBounds_ = function(divide) {
  let mergedDataRect = null;
  for (let j = 0; j < divide; j++) {
    const y1 = j * this.viewWindowManager_.canvasSize.height / divide;
    const y2 = (j + 1) * this.viewWindowManager_.canvasSize.height / divide;
    for (let i = 0; i < divide; i++) {
      const x1 = i * this.viewWindowManager_.canvasSize.width / divide;
      const x2 = (i + 1) * this.viewWindowManager_.canvasSize.width / divide;
      const bbox = this.viewWindowManager_.getViewRectBoundsFromWindow({ x1:x1, y1:y1, x2:x2, y2:y2 });
      const dataRect = this.projection.inverseBoundingBox(bbox);
      if (mergedDataRect === null) {
        mergedDataRect = dataRect;
      } else {
        mergedDataRect = GeographicRectUtils.unionIfIntersects(dataRect, mergedDataRect);
      }
    }
  }
  return mergedDataRect;
};

//   TODO 試験
MapView.prototype.getGeographicRectBounds = function() {
  const divide = this.calcStrategy_.calculate(this.viewWindowManager_.getRotate());
  const bbox1 = this.viewWindowManager_.getViewWindowBounds();
  const dataRect1 = this.projection.inverseBoundingBox(bbox1);
  if (divide === 1) {
    return dataRect1;
  }
  const mergedDataRect = this.getDividedGeographicRectBounds_(divide);
  //  分割した場合としない場合で範囲の狭い方を採用する
  const intersections = GeographicRectUtils.intersection(dataRect1, mergedDataRect);
  if (intersections && intersections.length === 1) {
    return intersections[0];
  } else {
    console.log(intersections);  //  起こりえないはず
    return dataRect1;
  }
};

MapView.prototype.invalidate = function() {
  this.isValid_ = false;
};

MapView.prototype.invalidateLayers = function() {
  for (let j = 0; j < this.layers_.length; ++j) {
    this.layers_[j].invalidate();
  }
};

MapView.prototype.loadData = function() {
  for (let j = 0; j < this.layers_.length; ++j) {
    this.layers_[j].loadData(this);
  }
  this.invalidate();
};

MapView.prototype.createTexture = function(img) {
  return this.imageProj.createTexture(img);
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
    for (let j = 0; j < this.layers_.length; ++j) {
      this.layers_[j].markInvalid();
    }
  } else if ( !this.requireRender_() ) {
    return false;
  }

  this.imageProj.clear(this.viewWindowManager_.canvasSize);

  const center = this.projection.getProjCenter();
  this.imageProj.setProjCenter(center.lambda, center.phi);

  const vc = this.viewWindowManager_.viewCenter;
  const vs = this.viewWindowManager_.viewWindowSize;
  const theta = this.viewWindowManager_.getRotate();
  this.imageProj.setTransform(vc, vs, theta);

  this.imageProj.setCanvasSize(this.viewWindowManager_.canvasSize);

  //
  for (let k = 0; k < this.layers_.length; ++k) {
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
  for (let j = 0; j < this.layers_.length; ++j) {
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
function Layer(layerId, coordType) {
  this.layerId = layerId;
  this.coordType = coordType;
  this.visibility = true;
  //
  this.isValid_ = false;
}

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
function TileTextureLayer(layerId, coordType, style, tileOpts, cacheOpts) {
  Layer.call(this, layerId, coordType);
  //
  this.tileManager = new TileManager(tileOpts);
  this.prevTileInfos_ = null;
  this.prevTransform_ = null;
  //
  const observer = function() {
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
}
Object.setPrototypeOf(TileTextureLayer.prototype, Layer.prototype);

//  override
TileTextureLayer.prototype.invalidate = function() {
  this.clearTileInfoCache_();
  this.markInvalid();
};

//  override
TileTextureLayer.prototype.loadData = function(mapView) {
  if ( this.tileManager.tileUrlDef == null )   return -1;
  const tileInfos = this.getTileInfos_(mapView);
  const count = this.requestImages_(mapView.imageProj.getGLContext(), tileInfos);
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
  const tileInfos = this.getTileInfos_(mapView);
  this.requestImages_(mapView.imageProj.getGLContext(), tileInfos);

  const textures = [];
  for (let i = 0; i < tileInfos.length; ++i ) {
    const info = tileInfos[i];
    const tex = this.imageCache.getTexture(info.url);
    if ( tex ) {
      tex.push(info.clipRect);
      textures.push(tex);
    }
  }
  if ( 0 < textures.length ) {
    mapView.imageProj.setCoordTypeData();
    mapView.imageProj.setOpacity(this.opacity);
    mapView.imageProj.prepareRenderSurface();
    for (let k = 0; k < textures.length; k++ ) {
      const texId = textures[k][0];
      const rect = textures[k][1];
      const clip = textures[k][2];
      mapView.imageProj.renderSurfaceTexture(texId, rect, clip);
    }
  }
  //
  this.markValid();
};


TileTextureLayer.prototype.clearTileInfoCache_ = function() {
  this.prevTransform_ = null;
  this.prevTileInfos_ = null;
  this.markInvalid();
};

TileTextureLayer.prototype.requestImages_ = function(gl, tileInfos) {
  let count = 0;
  for (let i = 0; i < tileInfos.length; ++i ) {
    if ( this.imageCache.loadImageIfAbsent(gl, tileInfos[i].url, tileInfos[i].rect) ) {
      ++count;
    }
  }
  return count;
};

TileTextureLayer.prototype.getTileInfos_ = function(mapView) {
  //  TODO 効率化、試験
  if ( this.prevTileInfos_ != null && this.prevTransform_ != null ) {
    if (this.prevTransform_.equals(mapView.viewWindowManager_.transform_)) {
      return this.prevTileInfos_;
    }
    this.prevTileInfos_ = null;
    this.prevTransform_ = null;
  }
  const dataRect = mapView.getGeographicRectBounds();
  const viewWindowScale = mapView.viewWindowManager_.getViewWindowScale();
  const level = (this.tileManager.dataLevelDef != null) ? this.tileManager.dataLevelDef(viewWindowScale, dataRect) : 0;
  const tileInfos = this.tileManager.getTileInfos(dataRect, level);
  //if (tileInfos.length == 0)  throw tileInfos;     //   TODO DEBUG!!
  this.prevTransform_ = mapView.viewWindowManager_.transform_.clone();
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
function PointTextureLayer(layerId, coordType, pointTextureId, style) {
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
}
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
function PolylineLayer(layerId, coordType, style) {
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
}
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
    for (let i = 0; i < this.data_.length; ++i) {
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
function GraticuleLayer(layerId, style) {
  Layer.call(this, layerId, ProjShaderProgram.COORD_TYPE_SCREEN);
  //
  //this.color = {r: 0.88, g: 0.88, b: 0.88, a: 1.0};
  this.intervalDegrees = 20;   //  単位：度   0以下の場合は緯度経度線を描画しない
  //
  if (typeof style !== 'undefined') {
    // if ('color' in style) {
    //   this.color = style.color;
    // }
    if ('intervalDegrees' in style) {
      this.intervalDegrees = style.intervalDegrees;
    }
  }
}
Object.setPrototypeOf(GraticuleLayer.prototype, Layer.prototype);

GraticuleLayer.prototype.invalidate = function() {
  this.markInvalid();
};

GraticuleLayer.prototype.render = function(mapView) {
  if ( 0 < this.intervalDegrees ) {
    mapView.imageProj.prepareRenderGraticule();
    mapView.imageProj.renderGraticule(this.intervalDegrees);
  }
  //
  this.markValid();
};

/* -------------------------------------------------------------------------- */
if (typeof module != 'undefined' && module.exports) {
  module.exports = MapView;
  module.exports.TileManager = TileManager;
  module.exports.ViewWindowManager = ViewWindowManager;
}
