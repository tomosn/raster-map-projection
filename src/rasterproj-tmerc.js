/**
 * Raster Map Projection v0.0.13  2016-11-13
 * Copyright (C) 2016 T.Seno
 * All rights reserved.
 * @license GPL v3 License (http://www.gnu.org/licenses/gpl.html)
 */
"use strict";

if (typeof module!='undefined' && module.exports) {
  var ProjMath = require('./rasterproj-common.js');
}



/**
 * Spherical Transverse Mercator Projection
 * @param {number} lam0  latitude of the center [rad].
 * @param {number} phi0  longitude of the center [rad].
 * @constructor
 */
var ProjTMERC = function(lam0, phi0) {
  this.lam0 = lam0;
  this.phi0 = phi0;
};

/**
 * 値域を表す矩形
 */
ProjTMERC.RANGE_RECTANGLE = [ -Math.PI, -Math.PI, +Math.PI, +Math.PI ];

ProjTMERC.prototype.getRange = function() {
  return ProjTMERC.RANGE_RECTANGLE.slice(0);
};

ProjTMERC.prototype.getProjCenter = function() {
  return { lambda: this.lam0, phi: this.phi0 };
};

//
ProjTMERC.prototype.forward = function(lambda, phi) {
  var b = Math.cos(phi) * Math.sin(lambda - this.lam0);
  var x = Math.log((1 + b) / (1 - b)) / 2.0;   //  = arctanh(B)
  var y = Math.atan2(Math.tan(phi), Math.cos(lambda - this.lam0)) - this.phi0;
  if ( y < -Math.PI || Math.PI <= y ) {
    y -= 2 * Math.PI * Math.floor((y + Math.PI) / (2*Math.PI));
  }
  return { x:x, y:y };
};


//
ProjTMERC.prototype.inverse = function(x, y) {
  var phi = this.inverse_phi_(x, y);
  var lam = this.inverse_lambda_(x, y);
  if ( lam < -Math.PI || Math.PI <= lam ) {
    lam -= 2 * Math.PI * Math.floor((lam + Math.PI) / (2*Math.PI));
  }
  return { lambda: lam, phi: phi };
};

ProjTMERC.prototype.inverse_phi_ = function(x, y) {
  return Math.asin(ProjMath.clamp(Math.sin(y + this.phi0) / Math.cosh(x), -1, 1));
};

ProjTMERC.prototype.inverse_lambda_ = function(x, y) {
  return Math.atan2(Math.sinh(x), Math.cos(y + this.phi0)) + this.lam0;
};

ProjTMERC.prototype.inverse_lambda_atY_ = function(x, y) {
  var cy = Math.cos(y + this.phi0);
  if ( cy === 0.0 ) {
    return (0 <= x) ? Math.PI/2 : -Math.PI/2;
  }
  var sx = Math.sinh(x);
  var v = Math.atan2(sx, cy) + this.lam0;
  if ( cy < 0 && sx < 0 ) {
    return v + 2 * Math.PI;
  } else {
    return v;
  }
};


ProjTMERC.prototype.containsNorthPole_ = function(x_min, y_min, x_max, y_max) {
  if (x_max < 0 || 0 < x_min)  return false;
  //var n = Math.ceil((y_max - y_min) / (2 * Math.PI)) + 1;

  var y0 = (2 * Math.floor((y_min + this.phi0) / (2 * Math.PI) - 0.5) + 0.5) * Math.PI - this.phi0;
  for (var i = 0; i < 256; ++i) {
    var y = y0 + 2 * Math.PI * i;
    if ( y_max < y )   break;
    if ( y_min <= y && y <= y_max )   return true;
  }
  return false;
};


ProjTMERC.prototype.containsSouthPole_ = function(x_min, y_min, x_max, y_max) {
  if (x_max < 0 || 0 < x_min)  return false;
  //var n = Math.ceil((y_max - y_min) / (2 * Math.PI)) + 1;

  var y0 = (2 * Math.floor((y_min + this.phi0) / (2 * Math.PI) + 0.5) - 0.5) * Math.PI - this.phi0;
  for (var i = 0; i < 256; ++i) {
    var y = y0 + 2 * Math.PI * i;
    if ( y_max < y )   break;
    if ( y_min <= y && y <= y_max )   return true;
  }
  return false;
};

//  TODO checked? 要テスト
ProjTMERC.prototype.inverseBoundingBox = function(x1, y1, x2, y2) {
  var x_min = (x1 <= x2) ? x1 : x2;
  var x_max = (x1 <= x2) ? x2 : x1;
  var y_min = (y1 <= y2) ? y1 : y2;
  var y_max = (y1 <= y2) ? y2 : y1;

  if ( x_min <= 0 && 0 <= x_max ) {
    var containsNorthPole = this.containsNorthPole_(x_min, y_min, x_max, y_max);
    var containsSouthPole = this.containsSouthPole_(x_min, y_min, x_max, y_max);

    //  N極,S極の双方を含む場合
    if ( containsNorthPole && containsSouthPole ) {
      return { lambda: [ -Math.PI, +Math.PI ], phi: [ -Math.PI/2, +Math.PI/2 ] };
    }
    //  N極,S極のどちらか一方を含む場合
    if ( containsNorthPole || containsSouthPole ) {
      var range = this.inversePhiRange_([x_min, x_max], [y_min, y_max]);
      if ( containsNorthPole ) {
        return { lambda: [-Math.PI, +Math.PI], phi: [range[0], Math.PI/2] };
      } else {
        return { lambda: [-Math.PI, +Math.PI], phi: [-Math.PI/2, range[1]] };
      }
    }
  }
  //  通常ケース
  var phiRange2 = this.inversePhiRange_([x_min, x_max], [y_min, y_max]);
  var lamRange2 = this.inverseLambdaRange_([x_min, x_max], [y_min, y_max]);
  lamRange2 = this.normalizeLambdaRange_(lamRange2);
  if (2 * Math.PI < lamRange2[1] - lamRange2[0]) {
    lamRange2 = [ -Math.PI, Math.PI ];
  }
  return { lambda: lamRange2, phi: phiRange2 };
};

//
ProjTMERC.prototype.mergeRange_ = function(origRange, newRange) {
  var range = null;
  if ( origRange == null ) {
    range = newRange;
  } else if ( newRange != null ) {
    range = origRange;
    if ( newRange[0] < range[0] ) {
      range[0] = newRange[0];
    }
    if ( range[1] < newRange[1] ) {
      range[1] = newRange[1];
    }
  }
  return range;
};

//
ProjTMERC.prototype.normalizeLambdaRange_ = function(range) {
  var lam = range[0];
  if ( -Math.PI <= lam && lam < Math.PI ) {
    return range;
  }
  var d = 2 * Math.PI * Math.floor( (lam + Math.PI) / (2 * Math.PI) );
  return [ range[0] - d, range[1] - d ];
};


//
ProjTMERC.prototype.inverseLambdaRange_ = function(xRange, yRange) {
  var x_min = (xRange[0] <= xRange[1]) ? xRange[0] : xRange[1];
  var x_max = (xRange[0] <= xRange[1]) ? xRange[1] : xRange[0];
  var y_min = (yRange[0] <= yRange[1]) ? yRange[0] : yRange[1];
  var y_max = (yRange[0] <= yRange[1]) ? yRange[1] : yRange[0];

  var rangeAtY = this.inverseLambdaRangeAtY_([x_min, x_max], [y_min, y_max]);
  var rangeAtX = this.inverseLambdaRangeAtX_([y_min, y_max], [x_min, x_max]);
  var range = this.mergeRange_(rangeAtX, rangeAtY);

  return range;
};

//
ProjTMERC.prototype.inverseLambdaRangeAtY_ = function(xRange, yValues) {
  var xmin = (xRange[0] <= xRange[1]) ? xRange[0] : xRange[1];
  var xmax = (xRange[0] <= xRange[1]) ? xRange[1] : xRange[0];

  var across = (xmin <= 0) && (0 <= xmax);

  var numY = yValues.length;
  var lam_min = null;
  var lam_max = null;

  for (var k = 0; k < numY; k++) {
    var y = yValues[k];

    var v = across ? this.inverse_lambda_atY_(xmin, y) : this.inverse_lambda_(xmin, y);
    if (lam_min === null || v < lam_min)  lam_min = v;
    if (lam_max === null || lam_max < v)  lam_max = v;

    v = across ? this.inverse_lambda_atY_(xmax, y) : this.inverse_lambda_(xmax, y);
    if (v < lam_min)  lam_min = v;
    if (lam_max < v)  lam_max = v;
  }

  if ( lam_min < -Math.PI || Math.PI <= lam_min ) {
    var dlam = 2 * Math.PI * Math.floor((lam_min + Math.PI) / (2*Math.PI));
    lam_min -= dlam;
    lam_max -= dlam;
  }
  return [lam_min, lam_max];
};

//
ProjTMERC.prototype.inverseLambdaRangeAtX_ = function(yRange, xValues) {
  var ymin = (yRange[0] <= yRange[1]) ? yRange[0] : yRange[1];
  var ymax = (yRange[0] <= yRange[1]) ? yRange[1] : yRange[0];

  var y0 = Math.PI * Math.floor((ymin + this.phi0)/ Math.PI) - this.phi0;

  var numX = xValues.length;
  var lam_min = null;
  var lam_max = null;

  for (var k = 0; k < numX; k++) {
    var x = xValues[k];

    var v = this.inverse_lambda_(x, ymin);
    if (lam_min === null || v < lam_min)  lam_min = v;
    if (lam_max === null || lam_max < v)  lam_max = v;

    v = this.inverse_lambda_(x, ymax);
    if (v < lam_min)  lam_min = v;
    if (lam_max < v)  lam_max = v;

    //  極値のチェック
    for (var i = 1; i <= 2; i++) {
      var y = y0 + Math.PI * i;
      if (y < ymin)  throw new Error('hoge!');  //  TODO delete
      if (ymax < y)   break;
      v = this.inverse_lambda_(x, y);
      if (v < lam_min)  lam_min = v;
      if (lam_max < v)  lam_max = v;
    }
  }

  if ( lam_min < -Math.PI || Math.PI <= lam_min ) {
    var dlam = 2 * Math.PI * Math.floor((lam_min + Math.PI) / (2*Math.PI));
    lam_min -= dlam;
    lam_max -= dlam;
  }
  return [lam_min, lam_max];
};

//
ProjTMERC.prototype.inversePhiRange_ = function(xRange, yRange) {
  var x_min = (xRange[0] <= xRange[1]) ? xRange[0] : xRange[1];
  var x_max = (xRange[0] <= xRange[1]) ? xRange[1] : xRange[0];
  var y_min = (yRange[0] <= yRange[1]) ? yRange[0] : yRange[1];
  var y_max = (yRange[0] <= yRange[1]) ? yRange[1] : yRange[0];

  var rangeAtY = this.inversePhiRangeAtY_([x_min, x_max], [y_min, y_max]);
  var rangeAtX = this.inversePhiRangeAtX_([y_min, y_max], [x_min, x_max]);
  var range = this.mergeRange_(rangeAtX, rangeAtY);

  return range;
};


//
ProjTMERC.prototype.inversePhiRangeAtY_ = function(xRange, yValues) {
  var xmin = (xRange[0] <= xRange[1]) ? xRange[0] : xRange[1];
  var xmax = (xRange[0] <= xRange[1]) ? xRange[1] : xRange[0];

  var numY = yValues.length;
  var phi_min = null;
  var phi_max = null;

  for (var k = 0; k < numY; k++) {
    var y = yValues[k];

    var v = this.inverse_phi_(xmin, y);
    if (phi_min === null || v < phi_min)  phi_min = v;
    if (phi_max === null || phi_max < v)  phi_max = v;

    v = this.inverse_phi_(xmax, y);
    if (v < phi_min)  phi_min = v;
    if (phi_max < v)  phi_max = v;

    if (xmin < 0 && 0 < xmax) {
      v = this.inverse_phi_(0.0, y);
    if (v < phi_min)  phi_min = v;
    if (phi_max < v)  phi_max = v;
    }
  }

  return [phi_min, phi_max];
};

//
ProjTMERC.prototype.inversePhiRangeAtX_ = function(yRange, xValues) {
  var ymin = (yRange[0] <= yRange[1]) ? yRange[0] : yRange[1];
  var ymax = (yRange[0] <= yRange[1]) ? yRange[1] : yRange[0];

  var y0 = Math.PI * (Math.floor((ymin + this.phi0)/ Math.PI + 0.5) - 0.5) - this.phi0;

  var numX = xValues.length;
  var phi_min = null;
  var phi_max = null;

  for (var k = 0; k < numX; k++) {
    var x = xValues[k];

    var v = this.inverse_phi_(x, ymin);
    if (phi_min === null || v < phi_min)  phi_min = v;
    if (phi_max === null || phi_max < v)  phi_max = v;

    v = this.inverse_phi_(x, ymax);
    if (v < phi_min)  phi_min = v;
    if (phi_max < v)  phi_max = v;

    //  極値のチェック
    for (var i = 1; i <= 2; i++) {
      var y = y0 + Math.PI * i;
      if (y < ymin)  throw new Error('hoge!');  //  TODO delete
      if (ymax < y)   break;
      v = this.inverse_phi_(x, y);
      if (v < phi_min)  phi_min = v;
      if (phi_max < v)  phi_max = v;
    }
  }

  return [phi_min, phi_max];
};


/* ------------------------------------------------------------ */

/**
 * GraticuleGeneratorTMERC
 */
var GraticuleGeneratorTMERC = function(proj, numPoints, span) {
  GraticuleGenerator.call(this, proj, numPoints, span);
};
Object.setPrototypeOf(GraticuleGeneratorTMERC.prototype, GraticuleGenerator.prototype);


GraticuleGeneratorTMERC.prototype.generateEquator_ = function(results, lamRange, trans) {
  //  87.5度分まで描画する
  var ptL = this.transform_(trans, this.projection.lam0 - Math.PI * 35 / 72, 0.0);
  var ptR = this.transform_(trans, this.projection.lam0 + Math.PI * 35 / 72, 0.0);
  var xl = (-1.0 < ptL[0]) ? ptL[0] : -1.0;
  var xr = (ptR[0] < +1.0) ? ptR[0] : +1.0;
  results.add([xl, ptL[1]]);
  results.add([xr, ptR[1]]);
  results.endPolyline();
  var pt2 = this.transform_(trans, this.projection.lam0 + Math.PI, 0.0);
  results.add([xl, pt2[1]]);
  results.add([xr, pt2[1]]);
  results.endPolyline();
};

GraticuleGeneratorTMERC.prototype.generateLongitudeLineAtLat = function(lat, results, lamRange, trans) {
  if ( lat === 0 ) {
    this.generateEquator_(results, lamRange, trans);
  } else {
    this.generateLongitudeLines_(results, lat * Math.PI / 180.0, lamRange, trans);
  }
};

/* ------------------------------------------------------------ */


/**
 * Projection of raster data.
 * @param {object} gl WebGL instance.
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 * @constructor
 */
var RasterProjTMERC = function() {
  this.shader_ = null;
  //
  this.backColor_ = { r: 0.0, g: 0.0, b: 0.0, a: 1.0 };
  this.graticuleColor_ = { r: 0.88, g: 0.88, b: 0.88, a: 1.0};
  this.alpha_ = 1.0;
  //
  this.projection = new ProjTMERC(0.0, 0.0);   // public
  //
  this.numberOfPoints = 64;
};

RasterProjTMERC.prototype.init = function(gl) {
  this.shader_ = new RasterProjShaderProgram(gl);

  var ret = this.shader_.init(RasterProjTMERC.VERTEX_SHADER_STR, RasterProjTMERC.FRAGMENT_SHADER_STR);
  if ( !ret ) {
    return false;
  }

  this.shader_.initAdditionalParams();

  var numberOfItems = 4 + 4 + this.numberOfPoints;
  this.shader_.initVBO(numberOfItems);
  this.shader_.setClearColor(this.backColor_);
  return true;
};

RasterProjTMERC.prototype.setAlpha = function(alpha) {
  this.alpha_ = alpha;
};

RasterProjTMERC.prototype.setProjCenter = function(lam0, phi0) {
  this.projection = new ProjTMERC(lam0, phi0);
};

RasterProjTMERC.prototype.clear = function(canvasSize) {
  this.shader_.clear(canvasSize);
};

RasterProjTMERC.prototype.prepareRender = function(texCoords, viewRect) {
  this.shader_.prepareRender(viewRect, texCoords, this.projection.lam0, this.projection.phi0, this.alpha_, this.graticuleColor_);
};

RasterProjTMERC.prototype.renderTextures = function(textureInfos) {
  this.shader_.setRenderType(RasterProjShaderProgram.RENDER_TYPE_TEXTURE);
  for ( var i = 0; i < textureInfos.length; ++i ) {
    var texture = textureInfos[i][0];
    var region = textureInfos[i][1];
    this.shader_.renderTexture(texture, region);
  }
};

RasterProjTMERC.prototype.renderOverlays = function(centerIcon, iconSize) {
  this.shader_.setRenderType(RasterProjShaderProgram.RENDER_TYPE_POINT_TEXTURE);
  this.shader_.renderIconTexture(centerIcon, iconSize, { x:0.0, y:0.0});
};

RasterProjTMERC.prototype.renderGraticule = function(viewRect, interval) {
  this.shader_.setRenderType(RasterProjShaderProgram.RENDER_TYPE_POLYLINE);

  var y1 = viewRect[1];
  var y2 = viewRect[3];
  var scaleY = 2.0 / (y2 - y1);    //   2 -> screen座標の [-1,+1] の縦方向の長さ
  var yn_max = Math.floor((y2 - Math.PI) / (2 * Math.PI)) + 1;
  var yn_min = - Math.floor((- y1 - Math.PI) / (2 * Math.PI)) - 1;

  var graticuleGenerator = new GraticuleGeneratorTMERC(this.projection, this.numberOfPoints, interval);
  if ( 0 < yn_max || yn_min < 0 ) {
      graticuleGenerator.checkScreenRect = function(pt) {
        return (-1.0 <= pt[0] && pt[0] <= 1.0);   //  x方向のチェックのみ
      };
  }
  var lines = graticuleGenerator.generateLines(viewRect);
  for (var k = 0; k < lines.length; ++k) {
    var points = new Float32Array(lines[k]);
    this.shader_.setPolylineData(points);
    this.shader_.renderPolylineData(points.length, 0.0);

    if ( 0 < yn_max ) {
      for (var i = 1; i <= yn_max; ++i) {
        var ty1 = 2 * i * Math.PI * scaleY;
        this.shader_.renderPolylineData(points.length, ty1);
      }
    }
    if ( yn_min < 0 ) {
      for (var j = -1; yn_min <= j; --j) {
        var ty2 = 2 * j * Math.PI * scaleY;
        this.shader_.renderPolylineData(points.length, ty2);
      }
    }
  }
};


RasterProjTMERC.VERTEX_SHADER_STR = [

  'precision highp float;',
  'attribute vec3 aPosition;',
  'attribute vec2 aTexCoord;',
  'uniform float uTranslateY;',
  'varying vec2 vTexCoord;',

  'void main()',
  '{',
  '  gl_Position = vec4(aPosition.x, aPosition.y + uTranslateY, aPosition.z, 1.0);',
  '  vTexCoord = aTexCoord;',
  '}'

].join("\n");


RasterProjTMERC.FRAGMENT_SHADER_STR = [

  'precision highp float;',
  'uniform sampler2D uTexture;',
  'varying vec2 vTexCoord;',
  'uniform lowp int uRenderType;',
  'uniform vec2 uProjCenter;',
  'uniform vec2 uViewXY1;',
  'uniform vec2 uViewXY2;',
  'uniform vec2 uDataCoord1;',
  'uniform vec2 uDataCoord2;',
  'uniform float uAlpha;',
  'uniform vec2 uFixedTextureSize;',    //  アイコンサイズ（画面比）
  'uniform vec4 uRenderColor;',
  'uniform bool uDrawGraticule;',

  'const float pi = 3.14159265;',
  'const float epsilon = 0.00000001;',
  'const float blurRatio = 0.015;',
  'const float xyRadius = pi;',

  'vec2 proj_invserse(vec2 center, vec2 xy)',
  '{',
  '  float d = xy.y + center.y;',

  '  float ep = exp(xy.x);',
  '  float em = exp(-xy.x);',
  '  float ch = (ep + em) / 2.0;',
  '  float sh = (ep - em) / 2.0;',

  '  float phi = asin( clamp( sin(d) / ch, -1.0, 1.0 ) );',
  '  float lam = mod( center.x + atan( sh, cos(d) ) + pi, 2.0 * pi ) - pi;',

  '  return vec2(lam, phi);',
  '}',

  'float inner_xy(vec2 xy)',
  '{',
  '  return 1.0;',
  '}',


  'void main()',
  '{',
  //  画面上の点 vTexCoord ([-1,-1]-[1,1]) をXY平面上の点にマッピング
  '  vec2 xy = mix(uViewXY1, uViewXY2, vTexCoord);',

  '  if ( uRenderType == 0 ) {',    //  Texture

  '    vec2 lp = proj_invserse(uProjCenter, xy);',
  '    vec2 ts = (lp - uDataCoord1) / (uDataCoord2 - uDataCoord1);',
  '    float inXY = inner_xy(xy);',
  '    vec2 inData = step(vec2(0.0, 0.0), ts) - step(vec2(1.0, 1.0), ts);',
  '    vec4 OutputColor = texture2D(uTexture, ts) * inData.x * inData.y * inXY;',
  '    OutputColor.a *= clamp(uAlpha, 0.0, 1.0);',
  '    gl_FragColor = OutputColor;',

  '  } else if ( uRenderType == 1 ) {',  //  PointTexture (icon)

  //   XY平面上の点を画像上の点[0,0]-[1,1]にマッピングする
  '    vec2 fixedTextureSizeXY = uFixedTextureSize * (uViewXY2 - uViewXY1);',
  '    vec2 r1 = vec2(uDataCoord1.x - 0.5 * fixedTextureSizeXY.x, uDataCoord1.x - 0.5 * fixedTextureSizeXY.y);',
  '    vec2 ts = (xy - r1) / fixedTextureSizeXY;',
  '    vec2 inData = (step(vec2(0.0, 0.0), ts) - step(vec2(1.0, 1.0), ts));',
  '    vec4 OutputColor = texture2D(uTexture, ts) * inData.x * inData.y;',
  '    gl_FragColor = OutputColor;',

  '  } else if ( uRenderType == 2 ) {',  //  Polyline

  '    gl_FragColor = uRenderColor;',

  '  }',
  '}'

].join("\n");



/* -------------------------------------------------------------------------- */
if (typeof module != 'undefined' && module.exports) {
  module.exports = RasterProjTMERC;
  module.exports.ProjTMERC = ProjTMERC;
}
