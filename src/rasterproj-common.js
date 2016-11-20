/**
 * Raster Map Projection v0.0.13  2016-11-13
 * Copyright (C) 2016 T.Seno
 * All rights reserved.
 * @license GPL v3 License (http://www.gnu.org/licenses/gpl.html)
 */
"use strict";


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

/* ------------------------------------------------------------ */

/**
 * Size : { width: Float, height: Float }
 * Point : { x: Float, y: Float }
 * GeoCoord : { lambda: Float, phi: Float }
 * Rectangle : { x1: Float, y1: Float, x2: Float, y2: Float }
 * Range : { min: Float, max: Float }
 */

/* ------------------------------------------------------------ */

var CommonUtils = function() {};

/**
 * Copy
 */
CommonUtils.clone = function(src) {
  var dst = {};
  for (var prop in src) {
    dst[prop] = src[prop];
  }
  return dst;
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
      return { min: Math.atan2(ymin, xmax), max: Math.atan2(ymax, xmin) };
    }
    if (xmax < 0) {
      return { min: Math.atan2(ymax, xmax), max: Math.atan2(ymin, xmin) };
    }
    return { min: Math.atan2(ymin, xmax), max: Math.atan2(ymin, xmin) };
  }

  //  y方向負の領域内
  if (ymax < 0) {
    if (0 < xmin) {
      return { min: Math.atan2(ymin, xmin), max: Math.atan2(ymax, xmax) };
    }
    if (xmax < 0) {
      return { min: Math.atan2(ymax, xmin), max: Math.atan2(ymin, xmax) };
    }
    return { min: Math.atan2(ymax, xmin), max: Math.atan2(ymax, xmax) };
  }

  //  x軸上の場合（原点を内部に含まない）
  if (0 < xmin) {
    return { min: Math.atan2(ymin, xmin), max: Math.atan2(ymax, xmin) };
  }
  if (xmax < 0) {
    //  周期性の考慮
    var t1 = Math.atan2(ymax, xmax);
    var t2 = Math.atan2(ymin, xmax);
    if (Math.PI <= t1) {
      return { min: t1 - 2 * Math.PI, max: t2 };
    } else {
      return { min: t1, max: t2 + 2 * Math.PI };
    }
  }

  //  原点を内部に含む
  return { min: -Math.PI, max: Math.PI };
};


ProjMath.toLambdaPhi = function(vec3d) {
  var r = Math.sqrt(vec3d[0] * vec3d[0] + vec3d[1] * vec3d[1]);
  var lam = Math.atan2( vec3d[1], vec3d[0] );
  var phi = Math.atan2( vec3d[2], r );
  return { lambda: lam, phi: phi };
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

var RasterProjShaderProgram = function(gl) {
  this.gl_ = gl;
  this.vbo_ = null;
  this.program_ = null;
  //
  this.locTexture_ = null;
  this.locAlpha_ = null;
  this.locProjCenter_ = null;
  this.locViewXY1_ = null;
  this.locViewXY2_ = null;
  this.locDataCoord1_ = null;
  this.locDataCoord2_ = null;
  this.locFixedTextureSize_ = null;
  this.locRenderColor_ = null;
  this.locRenderType_ = null;
  //
  this.locTranslateY_ = null;   //  TODO tmerc独自の処理の調整
};

RasterProjShaderProgram.DIMENSION = 2;

RasterProjShaderProgram.UNIT_RECT_TRIANGLE_STRIP = new Float32Array([
    -1.0, -1.0,
    -1.0, +1.0,
    +1.0, -1.0,
    +1.0, +1.0
  ]);


RasterProjShaderProgram.RENDER_TYPE_TEXTURE = 0;        // dim=2, dataType=GeoGraphic
RasterProjShaderProgram.RENDER_TYPE_POINT_TEXTURE = 1;  // dim=0, dataType=XYCoordinates
RasterProjShaderProgram.RENDER_TYPE_POLYLINE = 2;       // dim=1, dataType=??


RasterProjShaderProgram.prototype.init = function(vertShaderStr, fragShaderStr) {
  var vertexShader = this.loadShader_(this.gl_.VERTEX_SHADER, vertShaderStr);
  var fragmentShader = this.loadShader_(this.gl_.FRAGMENT_SHADER, fragShaderStr);

  var prog = this.gl_.createProgram();
  this.gl_.attachShader(prog, vertexShader);
  this.gl_.attachShader(prog, fragmentShader);

  this.gl_.bindAttribLocation(prog, 0, "aPosition");  //  TODO ??
  this.gl_.bindAttribLocation(prog, 1, "aTexCoord");
  this.gl_.linkProgram(prog);

  var linked = this.gl_.getProgramParameter(prog, this.gl_.LINK_STATUS);
  if (!linked && !this.gl_.isContextLost()) {
    var info = this.gl_.getProgramInfoLog(prog);
    alert("Error linking program:\n" + info);
    this.gl_.deleteProgram(prog);
    return false;
  }
  this.program_ = prog;

  this.locTexture_ = this.gl_.getUniformLocation(this.program_, "uTexture");
  this.locAlpha_ = this.gl_.getUniformLocation(this.program_, "uAlpha");
  this.locProjCenter_ = this.gl_.getUniformLocation(this.program_, "uProjCenter");
  this.locViewXY1_ = this.gl_.getUniformLocation(this.program_, "uViewXY1");
  this.locViewXY2_ = this.gl_.getUniformLocation(this.program_, "uViewXY2");
  this.locDataCoord1_ = this.gl_.getUniformLocation(this.program_, "uDataCoord1");
  this.locDataCoord2_ = this.gl_.getUniformLocation(this.program_, "uDataCoord2");
  this.locFixedTextureSize_ = this.gl_.getUniformLocation(this.program_, "uFixedTextureSize");
  this.locRenderColor_ = this.gl_.getUniformLocation(this.program_, "uRenderColor");
  this.locRenderType_ = this.gl_.getUniformLocation(this.program_, "uRenderType");

  //this.gl_.blendFunc(this.gl_.SRC_ALPHA, this.gl_.ONE);
  this.gl_.blendFunc(this.gl_.SRC_ALPHA, this.gl_.ONE_MINUS_SRC_ALPHA);

  return true;
};

RasterProjShaderProgram.prototype.initAdditionalParams = function() {
  this.locTranslateY_ = this.gl_.getUniformLocation(this.program_, "uTranslateY");  //  NOTICE tmerc独自
};

RasterProjShaderProgram.prototype.loadShader_ = function(type, shaderSrc) {
  var shader = this.gl_.createShader(type);
  this.gl_.shaderSource(shader, shaderSrc);
  this.gl_.compileShader(shader);
  if (!this.gl_.getShaderParameter(shader, this.gl_.COMPILE_STATUS) && !this.gl_.isContextLost()) {
    var info = this.gl_.getShaderInfoLog(shader);
    alert("Error compiling shader:\n" + info);
    this.gl_.deleteShader(shader);
    return null;
  }
  return shader;
};

RasterProjShaderProgram.prototype.setClearColor = function(color) {
  this.gl_.clearColor(color.r, color.g, color.b, color.a);
  this.gl_.enable(this.gl_.BLEND);
};

RasterProjShaderProgram.prototype.clear = function(canvasSize) {
  this.gl_.clear(this.gl_.COLOR_BUFFER_BIT);
  this.gl_.viewport(0, 0, canvasSize.width, canvasSize.height);
};

RasterProjShaderProgram.prototype.initVBO = function(numberOfItems) {
  this.vbo_ = this.gl_.createBuffer();
  this.gl_.bindBuffer(this.gl_.ARRAY_BUFFER, this.vbo_);
  this.gl_.bufferData(this.gl_.ARRAY_BUFFER, numberOfItems * 4 * 2, this.gl_.DYNAMIC_DRAW);
};

RasterProjShaderProgram.prototype.setRenderType = function(type) {
  this.gl_.uniform1i(this.locRenderType_, type);
};

RasterProjShaderProgram.prototype.prepareRender = function(viewRect, texCoords, lam0, phi0, alpha, lineColor) {
  this.gl_.useProgram(this.program_);

  this.gl_.uniform1f(this.locAlpha_, alpha);
  this.gl_.uniform4f(this.locRenderColor_, lineColor.r, lineColor.g, lineColor.b, lineColor.a);
  this.gl_.uniform2f(this.locProjCenter_, lam0, phi0);
  this.gl_.uniform2f(this.locViewXY1_, viewRect[0], viewRect[1]);
  this.gl_.uniform2f(this.locViewXY2_, viewRect[2], viewRect[3]);
  this.gl_.uniform1i(this.locTexture_, 0);

  if ( this.locTranslateY_ != null ) {
    this.gl_.uniform1f(this.locTranslateY_, 0.0);   //  NOTICE uTranslateY, tmerc独自
  }

  var offset = RasterProjShaderProgram.UNIT_RECT_TRIANGLE_STRIP.byteLength;
  this.gl_.bufferSubData(this.gl_.ARRAY_BUFFER, 0, RasterProjShaderProgram.UNIT_RECT_TRIANGLE_STRIP);
  this.gl_.bufferSubData(this.gl_.ARRAY_BUFFER, offset, texCoords);

  this.gl_.enableVertexAttribArray(0);
  this.gl_.vertexAttribPointer(0, RasterProjShaderProgram.DIMENSION, this.gl_.FLOAT, this.gl_.FALSE, 0, 0);
  this.gl_.enableVertexAttribArray(1);
  this.gl_.vertexAttribPointer(1, RasterProjShaderProgram.DIMENSION, this.gl_.FLOAT, this.gl_.FALSE, 0, offset);
};


//  TODO コメントとしてこれは残しておく
// RasterProjShaderProgram.prototype.prepareRenderPolyline = function() {
//   this.gl_.enableVertexAttribArray(0);
//   this.gl_.vertexAttribPointer(0, RasterProjShaderProgram.DIMENSION, this.gl_.FLOAT, this.gl_.FALSE, 0, 0);
//   this.gl_.enableVertexAttribArray(1);
//   this.gl_.vertexAttribPointer(1, RasterProjShaderProgram.DIMENSION, this.gl_.FLOAT, this.gl_.FALSE, 0, 0);
// };

//  TODO 要検討
RasterProjShaderProgram.prototype.renderIconTexture = function(texture, iconSize, xyPos) {
  this.gl_.bindTexture(this.gl_.TEXTURE_2D, texture);
  this.gl_.uniform2f(this.locDataCoord1_, xyPos.x, xyPos.y);
  this.gl_.uniform2f(this.locDataCoord2_, 0, 0);
  this.gl_.uniform2f(this.locFixedTextureSize_, iconSize.width, iconSize.height);
  this.gl_.drawArrays(this.gl_.TRIANGLE_STRIP, 0, 4);
};

RasterProjShaderProgram.prototype.renderTexture = function(texture, region) {
  var lam1 = region[0];
  var phi1 = region[1];
  var lam2 = region[2];
  var phi2 = region[3];

  this.gl_.bindTexture(this.gl_.TEXTURE_2D, texture);
  this.gl_.uniform2f(this.locDataCoord1_, lam1, phi1);
  this.gl_.uniform2f(this.locDataCoord2_, lam2, phi2);
  this.gl_.drawArrays(this.gl_.TRIANGLE_STRIP, 0, 4);
};

RasterProjShaderProgram.prototype.renderPolyline = function(points) {
  this.gl_.bufferSubData(this.gl_.ARRAY_BUFFER, 0, new Float32Array(points));
  this.gl_.drawArrays(this.gl_.LINE_STRIP, 0, points.length / 2);
};

RasterProjShaderProgram.prototype.setPolylineData = function(points) {
  this.gl_.bufferSubData(this.gl_.ARRAY_BUFFER, 0, new Float32Array(points));
};

RasterProjShaderProgram.prototype.renderPolylineData = function(numPoints, ty) {
  if (typeof ty !== 'undefined') {
    this.gl_.uniform1f(this.locTranslateY_, ty);    //  NOTICE uTranslateY, tmerc独自
  }
  this.gl_.drawArrays(this.gl_.LINE_STRIP, 0, numPoints / 2);
};

/* ------------------------------------------------------------ */

var GraticuleGenerator = function(proj, numPoints, span) {
  this.projection = proj;
  this.degUnit = span;
  this.maxNumPoints = numPoints;
  this.graticulePointsDistLimit = 0.01;  //  ２点間の間隔の平均がこれより大きい場合は分割する
  this.maxRecursion = 6;
};


GraticuleGenerator.prototype.transform_ = function(trans, lam, phi) {
  var xy = this.projection.forward(lam, phi);
  if ( xy ) {
    return trans.forwardPoint([xy.x, xy.y]);
  } else {
    return null;
  }
};

GraticuleGenerator.prototype.isFarAway_ = function(prevPt, pt, limit) {
  if ( !prevPt ) {
    return false;
  }
  var norm = Math.abs(prevPt[0] - pt[0]) + Math.abs(prevPt[1] - pt[1]);
  return limit < norm;
};

GraticuleGenerator.prototype.checkScreenRect = function(pt) {
  return (-1.0 <= pt[0] && pt[0] <= 1.0 && -1.0 <= pt[1] && pt[1] <= 1.0);
};


GraticuleGenerator.prototype.generateLatitudeLineAtLon = function(lon, results, phiRange, trans) {
  this.generateLatitudeLines_(results, lon * Math.PI / 180.0, phiRange, trans);
};

GraticuleGenerator.prototype.generateLongitudeLineAtLat = function(lat, results, lamRange, trans) {
  this.generateLongitudeLines_(results, lat * Math.PI / 180.0, lamRange, trans);
};


GraticuleGenerator.prototype.generateLines = function(viewWindowRect) {
  var x1 = viewWindowRect[0];
  var y1 = viewWindowRect[1];
  var x2 = viewWindowRect[2];
  var y2 = viewWindowRect[3];
  var dataRect = this.projection.inverseBoundingBox(x1, y1, x2, y2);

  var trans = new CoordTransform(viewWindowRect, [-1.0, -1.0, +1.0, +1.0]);
  var lonMin = Math.ceil((dataRect.lambda[0] * 180.0 / Math.PI + 180.0) / this.degUnit) * this.degUnit - 180.0;
  var latMin = Math.ceil((dataRect.phi[0] * 180.0 / Math.PI + 80.0) / this.degUnit) * this.degUnit - 80.0;

  var results = new PolylineContainer();

  var lonLimit = dataRect.lambda[1] * 180.0 / Math.PI;
  for (var lon = lonMin; lon <= 180 + 360; lon += this.degUnit) {
    if ( lonLimit < lon || lonMin + 360 <= lon )   break;
    this.generateLatitudeLineAtLon(lon, results, dataRect.phi, trans);
  }

  var latLimit = dataRect.phi[1] * 180.0 / Math.PI;
  for (var lat = latMin; lat <= 80; lat += this.degUnit) {
    if ( latLimit < lat )   break;
    this.generateLongitudeLineAtLat(lat, results, dataRect.lambda, trans);
  }

  return results.polylineArray;
};


GraticuleGenerator.prototype.generateLatitudeLines_ = function(results, lam, phiRange, trans) {
  var max = this.maxNumPoints - 1;
  var phiLimit = 80.0 * Math.PI / 180.0;
  var phiMin = (phiRange[0] < -phiLimit) ? -phiLimit : phiRange[0];
  var phiMax = (phiLimit < phiRange[1]) ? phiLimit : phiRange[1];
  if ( phiMin * phiMax < 0 ) {
    var interpolator1 = LatitudeLineInterpolator.create(this.projection, trans, lam, phiMin, 0.0, max);
    var interpolator2 = LatitudeLineInterpolator.create(this.projection, trans, lam, 0.0, phiMax, max);
    this.generateEachLine_(results, trans, interpolator1);
    this.generateEachLine_(results, trans, interpolator2);
  } else {
    var interpolator = LatitudeLineInterpolator.create(this.projection, trans, lam, phiMin, phiMax, max);
    this.generateEachLine_(results, trans, interpolator);
  }
};


GraticuleGenerator.prototype.generateLongitudeLines_ = function(results, phi, lamRange, trans) {
  var max = this.maxNumPoints - 1;
  if ( Math.PI < lamRange[1] - lamRange[0] ) {
    var lamMiddle = (lamRange[0] + lamRange[1]) / 2.0;
    var interpolator1 = LongitudeLineInterpolator.create(this.projection, trans, phi, lamRange[0], lamMiddle, max);
    var interpolator2 = LongitudeLineInterpolator.create(this.projection, trans, phi, lamMiddle, lamRange[1], max);
    this.generateEachLine_(results, trans, interpolator1);
    this.generateEachLine_(results, trans, interpolator2);
  } else {
    var interpolator = LongitudeLineInterpolator.create(this.projection, trans, phi, lamRange[0], lamRange[1], max);
    this.generateEachLine_(results, trans, interpolator);
  }
};


GraticuleGenerator.prototype.generateEachLine_ = function(results, trans, interpolator) {
  if ( !interpolator ) {
    return false;
  }

  if ( this.maxRecursion < interpolator.recurseCount() ) {
    console.log('over maxRecursion : count = ' + interpolator.recurseCount() );
    this.generateEachPoints_(results, trans, interpolator);
    return true;
  }

  var dist = interpolator.getNormBetweenEndPoints() / interpolator.max();

  if ( dist < this.graticulePointsDistLimit ) {
    this.generateEachPoints_(results, trans, interpolator);
    return true;
  }

  var divided = interpolator.divide(this.projection, trans);
  for ( var i = 0; i < divided.length; ++i ) {
    this.generateEachLine_(results, trans, divided[i]);
  }
  return true;
};


GraticuleGenerator.prototype.generateEachPoints_ = function(results, trans, interpolator) {
  var farAwayLimit = trans.scaleY() * Math.PI / 10;  //  値粋の平面のほぼ1/10  //  TODO 変更できるようにする

  var prevOutPt = null;
  if ( this.checkScreenRect(interpolator.iniPoint) ) {
    results.add(interpolator.iniPoint);
  } else {
    prevOutPt = interpolator.iniPoint;
  }
  var prevPt = interpolator.iniPoint;

  for (var i = 1; i < interpolator.max(); ++i) {
    var pt = this.transform_(trans, interpolator.lambda(i), interpolator.phi(i));
    if ( !pt ) {
      //  座標が無効→現在のポリラインを完了する
      results.endPolyline();
      prevOutPt = null;
    } else if ( this.checkScreenRect(pt) ) {
      //  座標が画面内
      //    直前の点がnullまたは隣接→点を追加、直前の点が領域外の場合はその点も追加
      //    直前の点が離れている→ポリラインを完了した後、別途ポリラインを開始
      if ( this.isFarAway_(prevPt, pt, farAwayLimit) ) {
        results.endPolyline();
        results.add(pt);
      } else {
        if ( prevOutPt ) {
          results.add(prevOutPt);
        }
        results.add(pt);
      }
      prevOutPt = null;
    } else {
      //  座標が画面外
      //    直前の点がnullまたは隣接→点を追加、ポリラインは閉じる。
      //    直前の点が離れている→点を追加せず、ポリラインは閉じる。
      if ( this.isFarAway_(prevPt, pt, farAwayLimit) ) {
        results.endPolyline();
      } else {
        results.endPolyline(pt);
      }
      prevOutPt = pt;
    }
    prevPt = pt;
  }
  if ( this.isFarAway_(prevPt, interpolator.finPoint, farAwayLimit) ) {
    results.endPolyline();
  } else {
    results.endPolyline(interpolator.finPoint);
  }
};

/* -------------------------------------------------------------------------- */

var LongitudeLineInterpolator = function(trans, phi, lam1, lam2, iniPt, finPt, max) {
  this.iniPoint = iniPt;
  this.finPoint = finPt;
  //
  this.phi_ = phi;
  this.lambda1_ = lam1;
  this.lambda2_ = lam2;
  this.max_ = max;
  this.length_ = lam2 - lam1;
  this.recurseCount_ = 0;
};


LongitudeLineInterpolator.create = function(proj, trans, phi, lam1, lam2, max) {
  var length = lam2 - lam1;

  var iniPt = null;
  var iniLam = null;
  var k = 0;
  var lam;
  for ( ; k < max; ++k) {
    lam = length * k / max + lam1;
    var xy1 = proj.forward(lam, phi);
    if ( xy1 ) {
      iniPt = trans.forwardPoint([xy1.x, xy1.y]);
      iniLam = lam;
      break;
    }
  }
  if ( !iniPt ) {
    return null;
  }
  var finPt = null;
  var finLam = null;
  for (var i = max; k < i; --i) {
    lam = length * i / max + lam1;
    var xy2 = proj.forward(lam, phi);
    if ( xy2 ) {
      finPt = trans.forwardPoint([xy2.x, xy2.y]);
      finLam = lam;
      break;
    }
  }
  if ( !finPt ) {
    return null;
  }
  return new LongitudeLineInterpolator(trans, phi, iniLam, finLam, iniPt, finPt, max);
};


LongitudeLineInterpolator.prototype.recurseCount = function() {
  return this.recurseCount_;
};

LongitudeLineInterpolator.prototype.max = function() {
  return this.max_;
};

LongitudeLineInterpolator.prototype.getNormBetweenEndPoints = function() {
  return Math.abs(this.finPoint[0] - this.iniPoint[0]) + Math.abs(this.finPoint[1] - this.iniPoint[1]);
};

LongitudeLineInterpolator.prototype.lambda = function(idx) {
  return this.length_ * idx / this.max_ + this.lambda1_;
};

LongitudeLineInterpolator.prototype.phi = function(idx) {
  return this.phi_;
};

LongitudeLineInterpolator.prototype.divide = function(proj, trans) {
  var array = [];
  var mid = (this.lambda1_ + this.lambda2_) / 2;
  var divided1 = LongitudeLineInterpolator.create(proj, trans, this.phi_, this.lambda1_, mid, this.max_);
  if ( divided1 ) {
    divided1.recurseCount_ = this.recurseCount_ + 1;
    array.push(divided1);
  }
  var divided2 = LongitudeLineInterpolator.create(proj, trans, this.phi_, mid, this.lambda2_, this.max_);
  if ( divided2 ) {
    divided2.recurseCount_ = this.recurseCount_ + 1;
    array.push(divided2);
  }
  return array;
};


/* -------------------------------------------------------------------------- */

var LatitudeLineInterpolator = function(trans, lam, phi1, phi2, iniPt, finPt, max) {
  this.iniPoint = iniPt;
  this.finPoint = finPt;
  //
  this.lambda_ = lam;
  this.phi1_ = phi1;
  this.phi2_ = phi2;
  this.max_ = max;
  this.length_ = phi2 - phi1;
  this.recurseCount_ = 0;
};


LatitudeLineInterpolator.create = function(proj, trans, lam, phi1, phi2, max) {
  var length = phi2 - phi1;

  var iniPt = null;
  var iniPhi = null;
  var k = 0;
  var phi;
  for ( ; k < max; ++k) {
    phi = length * k / max + phi1;
    var xy1 = proj.forward(lam, phi);
    if ( xy1 ) {
      iniPt = trans.forwardPoint([xy1.x, xy1.y]);
      iniPhi = phi;
      break;
    }
  }
  if ( !iniPt ) {
    return null;
  }
  var finPt = null;
  var finPhi = null;
  for (var i = max; k < i; --i) {
    phi = length * i / max + phi1;
    var xy2 = proj.forward(lam, phi);
    if ( xy2 ) {
      finPt = trans.forwardPoint([xy2.x, xy2.y]);
      finPhi = phi;
      break;
    }
  }
  if ( !finPt ) {
    return null;
  }
  return new LatitudeLineInterpolator(trans, lam, iniPhi, finPhi, iniPt, finPt, max);
};


LatitudeLineInterpolator.prototype.recurseCount = function() {
  return this.recurseCount_;
};

LatitudeLineInterpolator.prototype.max = function() {
  return this.max_;
};

LatitudeLineInterpolator.prototype.getNormBetweenEndPoints = function() {
  return Math.abs(this.finPoint[0] - this.iniPoint[0]) + Math.abs(this.finPoint[1] - this.iniPoint[1]);
};

LatitudeLineInterpolator.prototype.lambda = function(idx) {
  return this.lambda_;
};

LatitudeLineInterpolator.prototype.phi = function(idx) {
  return this.length_ * idx / this.max_ + this.phi1_;
};

LatitudeLineInterpolator.prototype.divide = function(proj, trans) {
  var array = [];
  var mid = (this.phi1_ + this.phi2_) / 2;
  var divided1 = LatitudeLineInterpolator.create(proj, trans, this.lambda_, this.phi1_, mid, this.max_);
  if ( divided1 ) {
    divided1.recurseCount_ = this.recurseCount_ + 1;
    array.push(divided1);
  }
  var divided2 = LatitudeLineInterpolator.create(proj, trans, this.lambda_, mid, this.phi2_, this.max_);
  if ( divided2 ) {
    divided2.recurseCount_ = this.recurseCount_ + 1;
    array.push(divided2);
  }
  return array;
};


/* -------------------------------------------------------------------------- */

var PolylineContainer = function() {
  this.polylineArray = [];
  this.currentPoints_ = null;
  this.currentIndex_ = 0;
};


PolylineContainer.prototype.endPolyline = function(pt) {
  if ( !this.currentPoints_ ) {
    return false;
  }
  var ret = false;
  if ( pt ) {
    this.currentPoints_[this.currentIndex_++] = pt[0];
    this.currentPoints_[this.currentIndex_++] = pt[1];
  }
  if ( 2 < this.currentPoints_.length ) {
    this.polylineArray.push(this.currentPoints_);
    ret = true;
  }
  this.currentPoints_ = null;
  this.currentIndex_ = 0;
  return true;
};

PolylineContainer.prototype.add = function(pt) {
  if ( !pt ) {
    return false;
  }
  if ( !this.currentPoints_ ) {
    this.currentPoints_ = [];
    this.currentIndex_ = 0;
  }
  this.currentPoints_[this.currentIndex_++] = pt[0];
  this.currentPoints_[this.currentIndex_++] = pt[1];
  return true;
};



/* -------------------------------------------------------------------------- */
if (typeof module != 'undefined' && module.exports) {
  module.exports = ProjMath;
}
