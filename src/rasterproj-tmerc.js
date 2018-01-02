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

RasterMapProjection.createProjection = function(lam0, phi0, optDivN) {
  return new ProjTMERC(lam0, phi0);
};

RasterMapProjection.createShaderProgram = function(gl) {
  return new TMERCProjShaderProgram(gl);
};

// -----------------------------------------------------

var TMERCProjShaderProgram = function(gl) {
  ProjShaderProgram.call(this, gl);
  this.locUnifBaseY_ = null;
};
Object.setPrototypeOf(TMERCProjShaderProgram.prototype, ProjShaderProgram.prototype);


TMERCProjShaderProgram.prototype.init = function(vertShaderStr, fragShaderStr) {
  var ret = ProjShaderProgram.prototype.init.call(this, vertShaderStr, fragShaderStr);
  if ( ret ) {
    this.locUnifBaseY_ = this.gl_.getUniformLocation(this.program_, 'uBaseY');   //  for TMERC
  }
  return ret;
};

TMERCProjShaderProgram.prototype.renderLatitudeLine = function(lam, phiList, viewWindow) {
  var idxY1 = 0;
  var idxY2 = 0;
  if ( viewWindow ) {
    idxY1 = this.getPeriodIndexY_(viewWindow[1]);
    idxY2 = this.getPeriodIndexY_(viewWindow[3]);
  }
  var midPhi = (phiList[0] + phiList[phiList.length-1]) / 2.0;
  var baseY = 0.0;
  if ( 0.0 < midPhi ) {
    baseY = Math.PI/2;
  } else if ( midPhi < 0.0 ) {
    baseY = -Math.PI/2;
  }
  for (var idxY = idxY1; idxY <= idxY2; ++idxY ) {
    this.gl_.uniform1f(this.locUnifBaseY_, 2 * Math.PI * idxY + baseY);
    ProjShaderProgram.prototype.renderLatitudeLine.call(this, lam, phiList);
  }
};

TMERCProjShaderProgram.prototype.renderLongitudeLine = function(phi, lamList, viewWindow) {
  var idxY1 = 0;
  var idxY2 = 0;
  if ( viewWindow ) {
    idxY1 = this.getPeriodIndexY_(viewWindow[1]);
    idxY2 = this.getPeriodIndexY_(viewWindow[3]);
  }
  var baseY = 0.0;        //  MEMO: longitudeLineについて、正規化ありでこの値で適切であることを確認
  for (var idxY = idxY1; idxY <= idxY2; ++idxY ) {
    this.gl_.uniform1f(this.locUnifBaseY_, 2 * Math.PI * idxY + baseY);
    ProjShaderProgram.prototype.renderLongitudeLine.call(this, phi, lamList);
  }
};

TMERCProjShaderProgram.prototype.getPeriodIndexY_ = function(y) {
  return Math.floor( (y + Math.PI) / (2*Math.PI) );
};

// -----------------------------------------------------

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
ProjTMERC.RANGE_RECTANGLE = [-Math.PI, -Math.PI, +Math.PI, +Math.PI];

ProjTMERC.prototype.getRange = function() {
  return ProjTMERC.RANGE_RECTANGLE.slice(0);
};

ProjTMERC.prototype.getProjCenter = function() {
  return {lambda: this.lam0, phi: this.phi0};
};

/**
 * @param {Float} lam
 * @param {Float} phi
 */
ProjTMERC.prototype.setProjCenter = function(lam, phi) {
  this.lam0 = lam;
  this.phi0 = phi;
};

/**
 * @param {Float} x
 * @param {Float} y
 * @param {Float} rate (option)
 */
ProjTMERC.prototype.checkXYDomain = function(x, y, rate) {
  //  TODO より最適な実装の検討
  return true;
};

//
ProjTMERC.prototype.forward = function(lambda, phi) {
  var b = Math.cos(phi) * Math.sin(lambda - this.lam0);
  var x = Math.log((1 + b) / (1 - b)) / 2.0;   //  = arctanh(B)
  var y = Math.atan2(Math.tan(phi), Math.cos(lambda - this.lam0)) - this.phi0;
  if ( y < -Math.PI || Math.PI <= y ) {
    y -= 2 * Math.PI * Math.floor((y + Math.PI) / (2*Math.PI));
  }
  return {x: x, y: y};
};


//
ProjTMERC.prototype.inverse = function(x, y) {
  var phi = this.inverse_phi_(x, y);
  var lam = this.inverse_lambda_(x, y);
  if ( lam < -Math.PI || Math.PI <= lam ) {
    lam -= 2 * Math.PI * Math.floor((lam + Math.PI) / (2*Math.PI));
  }
  return {lambda: lam, phi: phi};
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

//  TODO 要テスト？
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
      return {lambda: [-Math.PI, +Math.PI], phi: [-Math.PI/2, +Math.PI/2]};
    }
    //  N極,S極のどちらか一方を含む場合
    if ( containsNorthPole || containsSouthPole ) {
      var range = this.inversePhiRange_([x_min, x_max], [y_min, y_max]);
      if ( containsNorthPole ) {
        return {lambda: [-Math.PI, +Math.PI], phi: [range[0], Math.PI/2]};
      } else {
        return {lambda: [-Math.PI, +Math.PI], phi: [-Math.PI/2, range[1]]};
      }
    }
  }
  //  通常ケース
  var phiRange2 = this.inversePhiRange_([x_min, x_max], [y_min, y_max]);
  var lamRange2 = this.inverseLambdaRange_([x_min, x_max], [y_min, y_max]);
  lamRange2 = this.normalizeLambdaRange_(lamRange2);
  if (2 * Math.PI < lamRange2[1] - lamRange2[0]) {
    lamRange2 = [-Math.PI, Math.PI];
  }
  return {lambda: lamRange2, phi: phiRange2};
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
  return [range[0] - d, range[1] - d];
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
      //if (y < ymin)  throw new Error('assert!!');  //  TODO assert!!
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
      //if (y < ymin)  throw new Error('assert!!');  //  TODO assert!!
      if (ymax < y)   break;
      v = this.inverse_phi_(x, y);
      if (v < phi_min)  phi_min = v;
      if (phi_max < v)  phi_max = v;
    }
  }

  return [phi_min, phi_max];
};


/**
 * @return String
 */
ProjTMERC.prototype.getVertexShaderStr = function() {
  return ProjTMERC.VERTEX_SHADER_STR;
};

/**
 * @return String
 */
ProjTMERC.prototype.getFragmentShaderStr = function() {
  return ProjTMERC.FRAGMENT_SHADER_STR;
};


/**
 *
 */
ProjTMERC.VERTEX_SHADER_STR = [

  'precision highp float;',
  'attribute float aCoordX;',
  'attribute float aCoordY;',
  'uniform mat3 uFwdTransform;',
  'uniform vec2 uProjCenter;',
  'varying vec2 vCoord;',
  'varying float vInRange;',

  'uniform float uBaseY;',     //  基準となるビュー上のY座標

  'uniform float uPointSize;',
  'uniform lowp int uCoordType;',      // 入力座標系種別  0: Data Coordinates, 1: XY Coordinates, 2: Screen
  'uniform lowp int uTextureType;',    //  0:NotUse, 1:PointTexture, 2:SurfaceTexture

  'const float pi = 3.141592653589793;',
  //'const float epsilon = 0.00000001;',
  'const float epsilon = 0.001;',

  'vec2 proj_forward(vec2 center, vec2 lp, float baseY)',
  '{',
  '  float b = cos(lp.y) * sin(lp.x - center.x);',
  '  float x = log((1.0 + b) / (1.0 - b)) / 2.0;',    //  = arctanh(B)
  '  float y = atan(tan(lp.y), cos(lp.x - center.x));',
  '  float dy = y - baseY + pi;',
  '  if ( dy < 0.0 || 2.0*pi <= dy ) {',       //  この正規化の処理がない場合は緯度線で不正な縦線が生じることを確認済み(05/21)
  '    y = y - 2.0*pi * floor(dy / (2.0*pi));',
  '  }',
  '  return vec2(x, y - center.y);',
  '}',

  'float check_xy_range(vec2 xy)',
  '{',
  '  return step(-pi, xy.x) - step(pi, xy.x);',
  '}',

  'void main()',
  '{',
  '  vInRange = 1.0;',
  '  vec3 pos;',
  '  if ( uTextureType == 2 || uCoordType == 2 ) {',  //  Screen or Surface Texture
  '    pos = vec3(aCoordX, aCoordY, 1.0);',
  '  } else if ( uCoordType == 1 ) {',               //  XY Coord
  '    pos = uFwdTransform * vec3(aCoordX, aCoordY, 1.0);',
  '    vInRange = check_xy_range(vec2(aCoordX, aCoordY));',
  '  } else {',                                      //  Data Coord
  '    vec2 xy = proj_forward(uProjCenter, vec2(aCoordX, aCoordY), uBaseY);',
  '    vInRange = check_xy_range(xy);',
  '    pos = uFwdTransform * vec3(xy.x, xy.y, 1.0);',
  '  }',
  '  vCoord = pos.xy;',
  '  gl_Position = vec4(pos, 1.0);',
  '  gl_PointSize = uPointSize;',
  '}',

].join('\n');


/**
 *
 */
ProjTMERC.FRAGMENT_SHADER_STR = [

  'precision highp float;',
  'uniform mat3 uInvTransform;',
  'uniform vec2 uDataCoord1;',
  'uniform vec2 uDataCoord2;',
  'uniform vec2 uClipCoord1;',
  'uniform vec2 uClipCoord2;',
  'uniform lowp int uCoordType;',      // 入力座標系種別  0: Data Coordinates, 1: XY Coordinates, 2: Screen
  'uniform lowp int uTextureType;',    //  0:NotUse, 1:PointTexture, 2:SurfaceTexture
  'uniform sampler2D uTexture;',
  'uniform vec2 uProjCenter;',
  'uniform vec4 uColor;',
  'uniform float uOpacity;',

  'varying vec2 vCoord;',
  'varying float vInRange;',

  'const float pi = 3.141592653589793;',
  'const float epsilon = 0.00000001;',
  //'const float epsilon = 0.001;',
  //'const float blurRatio = 0.015;',
  'const float xyRadius = pi;',

  'vec2 proj_inverse(vec2 center, vec2 xy)',
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
  '  if ( vInRange < 0.5 ) {',
  '    discard;',
  '    return;',
  '  }',

  '  vec4 outColor;',
  '  bool isDiscard = false;',

  '  if ( uTextureType == 2 ) {',   //   Surface Texture
  '    float inXY = 1.0;',
  '    vec2 coord;',
  '    if ( uCoordType == 2 ) {',         //  Screen Coord
  '      coord = vCoord;',
  '    } else {',
  '      vec3 viewCoord = uInvTransform * vec3(vCoord.x, vCoord.y, 1.0);',
  '      inXY = inner_xy(viewCoord.xy);',
  '      if ( 0.0 < inXY ) {',
  '        if ( uCoordType == 1 ) {',  //  XY Coord
  '          coord = viewCoord.xy;',
  '        } else if ( uCoordType == 0 ) {',   //  Data Coord
  '          coord = proj_inverse(uProjCenter, viewCoord.xy);',
  '        }',
  '      } else {',
  '        isDiscard = true;',
  '        coord = vec2(0.0, 0.0);',
  '      }',
  '    }',

  '    if ( !isDiscard ) {',
  '      vec2 ts = (coord - uDataCoord1) / (uDataCoord2 - uDataCoord1);',
  '      if ( uClipCoord1.x <= ts.x && uClipCoord1.y <= ts.y && ts.x <= uClipCoord2.x && ts.y <= uClipCoord2.y) {',
  '        outColor = texture2D(uTexture, vec2(ts.x, 1.0 - ts.y)) * inXY;',
  '        outColor.a = outColor.a * uOpacity;',
  '      } else {',
  '        isDiscard = true;',
  '      }',
  '    }',

  '  } else if ( uTextureType == 1 ) {',          //   Point Texture
  '    outColor = texture2D(uTexture, gl_PointCoord);',
  '    isDiscard = (outColor.a == 0.0);',

  '  } else {',                           //  Not Texture
  '    outColor = uColor;',
  '    isDiscard = (outColor.a == 0.0);',
  '  }',

  '  if ( isDiscard ) {',
  '    discard;',
  '  } else {',
  '    gl_FragColor = outColor;',
  '  }',
  '}',

].join('\n');

/* -------------------------------------------------------------------------- */
if (typeof module != 'undefined' && module.exports) {
  module.exports = ProjTMERC;
}
