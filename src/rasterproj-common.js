/**
 * Raster Map Projection v0.0.22  2018-01-02
 * Copyright (C) 2016-2018 T.Seno
 * All rights reserved.
 * @license GPL v3 License (http://www.gnu.org/licenses/gpl.html)
 *
 */
'use strict';


if ( !Math.cosh ) {
  Math.cosh = function(x) {
    return (Math.exp(x) + Math.exp(-x)) / 2;
  };
}
if ( !Math.sinh ) {
  Math.sinh = function(x) {
    return (Math.exp(x) - Math.exp(-x)) / 2;
  };
}

// -----------------------------------------------------

var RasterMapProjection = function() {};

RasterMapProjection.createProjection = function(lam0, phi0, optDivN) {
  console.log('override!!');
  return null;
};

RasterMapProjection.createShaderProgram = function(gl) {
  return new ProjShaderProgram(gl);
};


/* ------------------------------------------------------------ */

/**
 * Size : { width: Float, height: Float }
 * Point : { x: Float, y: Float }
 * GeoCoord : { lambda: Float, phi: Float }
 * Rectangle : { x1: Float, y1: Float, x2: Float, y2: Float }
 * Range : { min: Float, max: Float }
 * Color : { r: Float, g: Float, b: Float, a: Float }
 */

/* ------------------------------------------------------------ */

var ImageUtils = function() {};

/**
 * createTexture
 */
ImageUtils.createTexture = function(gl, img) {
  var tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
};

/* ------------------------------------------------------------ */

/**
 * MathUtils
 */
var MathUtils = function() {};

/**
 * @param src : source rect x1:Float, y1:Float, x2:Float, y2:Float
 * @param dst : destination rect x1:Float, y1:Float, x2:Float, y2:Float
 */
MathUtils.getTransform = function(src, dst) {
  var dx = src.x2 - src.x1;
  var dy = src.y2 - src.y1;
  var sx = (dst.x2 - dst.x1) / dx;
  var sy = (dst.y2 - dst.y1) / dy;
  var tx = (dst.x1 * src.x2 - src.x1 * dst.x2) / dx;
  var ty = (dst.y1 * src.y2 - src.y1 * dst.y2) / dy;
  return [sx, 0.0, 0.0,   0.0, sy, 0.0,  tx, ty, 1.0];
};

/* ------------------------------------------------------------ */

/**
 * 数学関数ユーティリティ
 */
var ProjMath = function() {};

ProjMath.EPSILON = 1.0e-7;

ProjMath.SQRT_2 = Math.sqrt(2);

ProjMath.PI_SQ = Math.PI * Math.PI;
ProjMath.HALF_PI = Math.PI / 2;


ProjMath.clamp = function(x, min, max) {
  return Math.max(min, Math.min(max, x));
};


/**
 * atan2(y,x)の範囲を求める。
 * @param {Range} yRange
 * @param {Range} xRange
 * @return {Range}
 */
ProjMath.atan2Range = function(yRange, xRange) {
  console.assert(yRange.min <= yRange.max);
  console.assert(xRange.min <= xRange.max);

  var xmin = xRange.min;
  var xmax = xRange.max;
  var ymin = yRange.min;
  var ymax = yRange.max;

  //  y方向正の領域内
  if (0 <= ymin) {
    if (0 < xmin) {
      return {min: Math.atan2(ymin, xmax), max: Math.atan2(ymax, xmin)};
    }
    if (xmax < 0) {
      return {min: Math.atan2(ymax, xmax), max: Math.atan2(ymin, xmin)};
    }
    return {min: Math.atan2(ymin, xmax), max: Math.atan2(ymin, xmin)};
  }

  //  y方向負の領域内
  if (ymax < 0) {
    if (0 < xmin) {
      return {min: Math.atan2(ymin, xmin), max: Math.atan2(ymax, xmax)};
    }
    if (xmax < 0) {
      return {min: Math.atan2(ymax, xmin), max: Math.atan2(ymin, xmax)};
    }
    return {min: Math.atan2(ymax, xmin), max: Math.atan2(ymax, xmax)};
  }

  //  x軸上の場合（原点を内部に含まない）
  if (0 < xmin) {
    return {min: Math.atan2(ymin, xmin), max: Math.atan2(ymax, xmin)};
  }
  if (xmax < 0) {
    //  周期性の考慮
    var t1 = Math.atan2(ymax, xmax);
    var t2 = Math.atan2(ymin, xmax);
    if (Math.PI <= t1) {
      return {min: t1 - 2 * Math.PI, max: t2};
    } else {
      return {min: t1, max: t2 + 2 * Math.PI};
    }
  }

  //  原点を内部に含む
  return {min: -Math.PI, max: Math.PI};
};


ProjMath.toLambdaPhi = function(vec3d) {
  var r = Math.sqrt(vec3d[0] * vec3d[0] + vec3d[1] * vec3d[1]);
  var lam = Math.atan2( vec3d[1], vec3d[0] );
  var phi = Math.atan2( vec3d[2], r );
  return {lambda: lam, phi: phi};
};


ProjMath.normalizeLambda = function(lam) {
  if ( -Math.PI <= lam && lam < Math.PI ) {
    return lam;
  }
  return lam - 2 * Math.PI * Math.floor( (lam + Math.PI) / (2 * Math.PI) );
};


ProjMath.neighborPoint = function(pt1, pt2) {
  if ( ProjMath.EPSILON <= Math.abs(pt1.phi - pt2.phi) ) {
    return false;
  }
  var lam1 = ProjMath.normalizeLambda(pt1.lambda);
  var lam2 = ProjMath.normalizeLambda(pt2.lambda);
  return Math.abs(lam1 - lam2) < ProjMath.EPSILON;
};

/* ------------------------------------------------------------ */

/**
 * ProjShaderProgram
 * @constructor
 */
var ProjShaderProgram = function(gl) {
  this.gl_ = gl;
  this.vbo_ = null;
  this.program_ = null;
  //
  this.coordsBuffer_ = null;
  //
  this.locAttrCoordX_ = null;
  this.locAttrCoordY_ = null;
  this.locUnifFwdTransform_ = null;
  this.locUnifInvTransform_ = null;
  this.locUnifProjCenter_ = null;
  this.locUnifDataCoord1_ = null;
  this.locUnifDataCoord2_ = null;
  this.locUnifClipCoord1_ = null;
  this.locUnifClipCoord2_ = null;
  this.locUnifPointSize_ = null;
  this.locUnifCoordType_ = null;
  this.locUnifColor_ = null;
  this.locUnifOpacity_ = null;
  this.locUnifTextureType_ = null;
  this.locUnifTexture_ = null;
};

/**
 *
 */
ProjShaderProgram.SCREEN_RECT = {x1: -1.0, y1: -1.0, x2: +1.0, y2: +1.0};

/**
 *
 */
ProjShaderProgram.DIMENSION = 2;

/**
 *
 */
ProjShaderProgram.POINTS_BUFFER_SIZE = 64;

/**
 *
 */
ProjShaderProgram.COORD_TYPE_DATA = 0;          //  データ座標系

/**
 *
 */
ProjShaderProgram.COORD_TYPE_XY = 1;            //  XY座標系

/**
 *
 */
ProjShaderProgram.COORD_TYPE_SCREEN = 2;        //  SCREEN座標系（テクスチャ描画用）

/**
 *
 */
ProjShaderProgram.TEXTURE_TYPE_NONE = 0;        //  テクスチャ未使用

/**
 *
 */
ProjShaderProgram.TEXTURE_TYPE_POINT = 1;        //  PointTexture

/**
 *
 */
ProjShaderProgram.TEXTURE_TYPE_SURFACE = 2;        //  SurfaceTexture


/**
 * @param color
 */
ProjShaderProgram.prototype.setColor = function(color) {
  this.gl_.uniform4f(this.locUnifColor_, color.r, color.g, color.b, color.a);
};

/**
 * @param x1
 * @param y1
 * @param x2
 * @param y2
 */
ProjShaderProgram.prototype.setViewWindow = function(x1, y1, x2, y2) {
  //  uFwdTransform : [(x1, y1)-(x2, y2)] -> [(-1.0, -1.0)-(+1.0, +1.0)]
  //  uInvTransform : [(-1.0, -1.0)-(+1.0, +1.0)] -> [(x1, y1)-(x2, y2)]
  var dx = x2 - x1;
  var dy = y2 - y1;
  var mx = x1 + x2;
  var my = y1 + y2;

  var mat = [2.0/dx, 0.0, 0.0,   0.0, 2.0/dy, 0.0,  -mx/dx, -my/dy, 1.0];
  var inv = [dx/2.0, 0.0, 0.0,   0.0, dy/2.0, 0.0,  mx/2.0, my/2.0, 1.0];

  this.gl_.uniformMatrix3fv(this.locUnifFwdTransform_, false, mat);
  this.gl_.uniformMatrix3fv(this.locUnifInvTransform_, false, inv);
};

/**
 * @param lam0
 * @param phi0
 */
ProjShaderProgram.prototype.setProjCenter = function(lam0, phi0) {
  this.gl_.uniform2f(this.locUnifProjCenter_, lam0, phi0);
};

/**
 * @param sizef
 */
ProjShaderProgram.prototype.setPointSize = function(sizef) {
  this.gl_.uniform1f(this.locUnifPointSize_, sizef);
};

/**
 * @param texture or null
 */
ProjShaderProgram.prototype.setPointTexture = function(texture) {
  if ( texture != null ) {
    this.setTextureType_(ProjShaderProgram.TEXTURE_TYPE_POINT);
    this.bindTexture(texture);
  } else {
    this.setTextureType_(ProjShaderProgram.TEXTURE_TYPE_NONE);
    this.bindTexture(null);
  }
};

/**
 *
 */
ProjShaderProgram.prototype.setCoordType = function(type) {
  this.gl_.uniform1i(this.locUnifCoordType_, type);
};

/**
 *
 */
ProjShaderProgram.prototype.setCoordTypeData = function() {
  this.gl_.uniform1i(this.locUnifCoordType_, ProjShaderProgram.COORD_TYPE_DATA);
};

/**
 *
 */
ProjShaderProgram.prototype.setCoordTypeXY = function() {
  this.gl_.uniform1i(this.locUnifCoordType_, ProjShaderProgram.COORD_TYPE_XY);
};

/**
 *
 */
ProjShaderProgram.prototype.setCoordTypeScreen = function() {
  this.gl_.uniform1i(this.locUnifCoordType_, ProjShaderProgram.COORD_TYPE_SCREEN);
};

/**
 * @param color
 */
ProjShaderProgram.prototype.setClearColor = function(color) {
  this.gl_.clearColor(color.r, color.g, color.b, color.a);
  this.gl_.enable(this.gl_.BLEND);
};

/**
 * @param canvasSize
 */
ProjShaderProgram.prototype.clear = function(canvasSize) {
  this.gl_.clear(this.gl_.COLOR_BUFFER_BIT);
  this.gl_.viewport(0, 0, canvasSize.width, canvasSize.height);
};

/**
 * @param opacity
 */
ProjShaderProgram.prototype.setOpacity = function(opacity) {
  this.gl_.uniform1f(this.locUnifOpacity_, opacity);
};

/**
 * @param texture
 */
ProjShaderProgram.prototype.bindTexture = function(texture) {
  this.gl_.activeTexture(this.gl_.TEXTURE0);
  this.gl_.bindTexture(this.gl_.TEXTURE_2D, texture);
};

/**
 * @param textureType
 */
ProjShaderProgram.prototype.setTextureType_ = function(textureType) {
  this.gl_.uniform1i(this.locUnifTextureType_, textureType);
};

/**
 * @param viewRect
 */
ProjShaderProgram.prototype.prepareRenderSurface = function() {
  this.gl_.enableVertexAttribArray(this.locAttrCoordX_);
  this.gl_.vertexAttribPointer(this.locAttrCoordX_, 1, this.gl_.FLOAT, this.gl_.FALSE, 4*2, 0);
  this.gl_.enableVertexAttribArray(this.locAttrCoordY_);
  this.gl_.vertexAttribPointer(this.locAttrCoordY_, 1, this.gl_.FLOAT, this.gl_.FALSE, 4*2, 4);

  var data = new Float32Array([
    // Screen(x,y)
    -1.0, +1.0,
    -1.0, -1.0,
    +1.0, +1.0,
    +1.0, -1.0,
  ]);
  this.gl_.bufferSubData(this.gl_.ARRAY_BUFFER, 0, data);

  this.gl_.activeTexture(this.gl_.TEXTURE0);

  this.setTextureType_(ProjShaderProgram.TEXTURE_TYPE_SURFACE);
  this.bindTexture(null);
};

/**
 *
 */
ProjShaderProgram.prototype.prepareRenderPoints = function() {
  this.gl_.enableVertexAttribArray(this.locAttrCoordX_);
  this.gl_.vertexAttribPointer(this.locAttrCoordX_, 1, this.gl_.FLOAT, this.gl_.FALSE, 4*2, 0);
  this.gl_.enableVertexAttribArray(this.locAttrCoordY_);
  this.gl_.vertexAttribPointer(this.locAttrCoordY_, 1, this.gl_.FLOAT, this.gl_.FALSE, 4*2, 4);

  this.setTextureType_(ProjShaderProgram.TEXTURE_TYPE_NONE);
  this.bindTexture(null);
};

/**
 *
 */
ProjShaderProgram.prototype.prepareRenderPolyline = function() {
  this.gl_.enableVertexAttribArray(this.locAttrCoordX_);
  this.gl_.vertexAttribPointer(this.locAttrCoordX_, 1, this.gl_.FLOAT, this.gl_.FALSE, 4*2, 0);
  this.gl_.enableVertexAttribArray(this.locAttrCoordY_);
  this.gl_.vertexAttribPointer(this.locAttrCoordY_, 1, this.gl_.FLOAT, this.gl_.FALSE, 4*2, 4);

  this.setTextureType_(ProjShaderProgram.TEXTURE_TYPE_NONE);
  this.bindTexture(null);
};

/**
 *
 */
ProjShaderProgram.prototype.prepareRenderLatitudeLine = function() {
  this.gl_.disableVertexAttribArray(this.locAttrCoordX_);
  this.gl_.enableVertexAttribArray(this.locAttrCoordY_);
  this.gl_.vertexAttribPointer(this.locAttrCoordY_, 1, this.gl_.FLOAT, this.gl_.FALSE, 0, 0);

  this.setTextureType_(ProjShaderProgram.TEXTURE_TYPE_NONE);
  this.bindTexture(null);
};

/**
 *
 */
ProjShaderProgram.prototype.prepareRenderLongitudeLine = function() {
  this.gl_.disableVertexAttribArray(this.locAttrCoordY_);
  this.gl_.enableVertexAttribArray(this.locAttrCoordX_);
  this.gl_.vertexAttribPointer(this.locAttrCoordX_, 1, this.gl_.FLOAT, this.gl_.FALSE, 0, 0);

  this.setTextureType_(ProjShaderProgram.TEXTURE_TYPE_NONE);
  this.bindTexture(null);
};

/**
 * @param textureId
 * @param dataRect
 */
ProjShaderProgram.prototype.renderSurfaceTexture = function(textureId, dataRect, clipRect) {
  this.gl_.bindTexture(this.gl_.TEXTURE_2D, textureId);

  this.gl_.uniform2f(this.locUnifDataCoord1_, dataRect[0], dataRect[1]);
  this.gl_.uniform2f(this.locUnifDataCoord2_, dataRect[2], dataRect[3]);

  if (clipRect) {
    this.gl_.uniform2f(this.locUnifClipCoord1_, clipRect[0], clipRect[1]);
    this.gl_.uniform2f(this.locUnifClipCoord2_, clipRect[2], clipRect[3]);
  } else {
    this.gl_.uniform2f(this.locUnifClipCoord1_, 0.0, 0.0);
    this.gl_.uniform2f(this.locUnifClipCoord2_, 1.0, 1.0);
  }

  this.gl_.drawArrays(this.gl_.TRIANGLE_STRIP, 0, 4);
};

/**
 * @param points
 */
ProjShaderProgram.prototype.renderPolyline = function(points) {
  if ( points.length / 2 <= ProjShaderProgram.POINTS_BUFFER_SIZE ) {
    this.gl_.bufferSubData(this.gl_.ARRAY_BUFFER, 0, new Float32Array(points));
    this.gl_.drawArrays(this.gl_.LINE_STRIP, 0, points.length / 2);
  } else {
    var endIdx = 0;
    var nextEndIdx = 0;
    do {
      nextEndIdx = endIdx + ProjShaderProgram.POINTS_BUFFER_SIZE * 2;
      if ( points.length < nextEndIdx ) {
        nextEndIdx = points.length;
      }
      var buff = points.slice(endIdx, nextEndIdx);
      this.gl_.bufferSubData(this.gl_.ARRAY_BUFFER, 0, new Float32Array(buff));
      this.gl_.drawArrays(this.gl_.LINE_STRIP, 0, buff.length / 2);
      endIdx = nextEndIdx - 2;    //  分割する点は前後の配列双方に含める
    } while ( nextEndIdx < points.length );
  }
};

/**
 * @param points
 */
ProjShaderProgram.prototype.renderPoints = function(points) {
  if ( points.length / 2 <= ProjShaderProgram.POINTS_BUFFER_SIZE ) {
    this.gl_.bufferSubData(this.gl_.ARRAY_BUFFER, 0, new Float32Array(points));
    this.gl_.drawArrays(this.gl_.POINTS, 0, points.length / 2);
  } else {
    var endIdx = 0;
    var nextEndIdx = 0;
    do {
      nextEndIdx = endIdx + ProjShaderProgram.POINTS_BUFFER_SIZE * 2;
      if ( points.length < nextEndIdx ) {
        nextEndIdx = points.length;
      }
      var buff = points.slice(endIdx, nextEndIdx);
      this.gl_.bufferSubData(this.gl_.ARRAY_BUFFER, 0, new Float32Array(buff));
      this.gl_.drawArrays(this.gl_.POINTS, 0, buff.length / 2);
      endIdx = nextEndIdx;
    } while ( nextEndIdx < points.length );
  }
};

/**
 * @param lam
 * @param phiList
 * @param viewWindow 省略可
 */
ProjShaderProgram.prototype.renderLatitudeLine = function(lam, phiList, viewWindow) {
  this.gl_.vertexAttrib1f(this.locAttrCoordX_, lam);
  this.gl_.bufferSubData(this.gl_.ARRAY_BUFFER, 0, new Float32Array(phiList));
  this.gl_.drawArrays(this.gl_.LINE_STRIP, 0, phiList.length);
};

/**
 * @param phi
 * @param lamList
 * @param viewWindow 省略可
 */
ProjShaderProgram.prototype.renderLongitudeLine = function(phi, lamList, viewWindow) {
  this.gl_.vertexAttrib1f(this.locAttrCoordY_, phi);
  this.gl_.bufferSubData(this.gl_.ARRAY_BUFFER, 0, new Float32Array(lamList));
  this.gl_.drawArrays(this.gl_.LINE_STRIP, 0, lamList.length);
};

/**
 * @param vertShaderStr
 * @param fragShaderStr
 */
ProjShaderProgram.prototype.init = function(vertShaderStr, fragShaderStr) {
  var vertexShader = this.loadShader_(this.gl_.VERTEX_SHADER, vertShaderStr);
  var fragmentShader = this.loadShader_(this.gl_.FRAGMENT_SHADER, fragShaderStr);

  var prog = this.gl_.createProgram();
  this.gl_.attachShader(prog, vertexShader);
  this.gl_.attachShader(prog, fragmentShader);

  this.gl_.linkProgram(prog);

  var linked = this.gl_.getProgramParameter(prog, this.gl_.LINK_STATUS);
  if (!linked && !this.gl_.isContextLost()) {
    var info = this.gl_.getProgramInfoLog(prog);
    alert('Error linking program:\n' + info);
    this.gl_.deleteProgram(prog);
    return false;
  }
  this.program_ = prog;

  this.gl_.useProgram(this.program_);

  this.locAttrCoordX_ = this.gl_.getAttribLocation(this.program_, 'aCoordX');
  this.locAttrCoordY_ = this.gl_.getAttribLocation(this.program_, 'aCoordY');

  this.locUnifFwdTransform_ = this.gl_.getUniformLocation(this.program_, 'uFwdTransform');
  this.locUnifInvTransform_ = this.gl_.getUniformLocation(this.program_, 'uInvTransform');
  this.locUnifProjCenter_ = this.gl_.getUniformLocation(this.program_, 'uProjCenter');
  this.locUnifDataCoord1_ = this.gl_.getUniformLocation(this.program_, 'uDataCoord1');
  this.locUnifDataCoord2_ = this.gl_.getUniformLocation(this.program_, 'uDataCoord2');
  this.locUnifClipCoord1_ = this.gl_.getUniformLocation(this.program_, 'uClipCoord1');
  this.locUnifClipCoord2_ = this.gl_.getUniformLocation(this.program_, 'uClipCoord2');
  this.locUnifPointSize_ = this.gl_.getUniformLocation(this.program_, 'uPointSize');
  this.locUnifCoordType_ = this.gl_.getUniformLocation(this.program_, 'uCoordType');
  this.locUnifColor_ = this.gl_.getUniformLocation(this.program_, 'uColor');
  this.locUnifOpacity_ = this.gl_.getUniformLocation(this.program_, 'uOpacity');
  this.locUnifTextureType_ = this.gl_.getUniformLocation(this.program_, 'uTextureType');
  this.locUnifTexture_ = this.gl_.getUniformLocation(this.program_, 'uTexture');

  this.coordsBuffer_ = this.createBuffer_(ProjShaderProgram.DIMENSION, ProjShaderProgram.POINTS_BUFFER_SIZE);
  this.gl_.bindBuffer(this.gl_.ARRAY_BUFFER, this.coordsBuffer_.buffer);

  this.setClearColor({r: 0.0, g: 0.1, b: 0.0, a: 1.0});
  this.setOpacity(1.0);

  this.gl_.blendFunc(this.gl_.SRC_ALPHA, this.gl_.ONE_MINUS_SRC_ALPHA);

  return true;
};

/**
 * @param type
 * @param shaderSrc
 */
ProjShaderProgram.prototype.loadShader_ = function(type, shaderSrc) {
  var shader = this.gl_.createShader(type);
  this.gl_.shaderSource(shader, shaderSrc);
  this.gl_.compileShader(shader);
  if (!this.gl_.getShaderParameter(shader, this.gl_.COMPILE_STATUS) && !this.gl_.isContextLost()) {
    var info = this.gl_.getShaderInfoLog(shader);
    alert('Error compiling shader:\n' + info);
    this.gl_.deleteShader(shader);
    return null;
  }
  return shader;
};

/**
 * @param dim
 * @param maxNum
 */
ProjShaderProgram.prototype.createBuffer_ = function(dim, maxNum) {
  //  データ型はFloat32を前提
  var buff = this.gl_.createBuffer();
  this.gl_.bindBuffer(this.gl_.ARRAY_BUFFER, buff);
  this.gl_.bufferData(this.gl_.ARRAY_BUFFER, maxNum * dim * 4, this.gl_.DYNAMIC_DRAW);
  return {buffer: buff, dimension: dim, maxNum: maxNum};
};


/* ------------------------------------------------------------ */
if (typeof module != 'undefined' && module.exports) {
  module.exports = ProjShaderProgram;
}
