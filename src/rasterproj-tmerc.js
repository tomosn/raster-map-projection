/**
 * Raster Map Projection v0.0.27  2019-02-10
 * Copyright (C) 2016-2019 T.Seno
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

// -----------------------------------------------------

/**
 * Spherical Transverse Mercator Projection
 * @param {number} lam0  latitude of the center [rad].
 * @param {number} phi0  longitude of the center [rad].
 * @constructor
 */
function ProjTMERC(lam0, phi0) {
  this.lam0 = lam0;
  this.phi0 = phi0;
}

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
  const b = Math.cos(phi) * Math.sin(lambda - this.lam0);
  const x = Math.log((1 + b) / (1 - b)) / 2.0;   //  = arctanh(B)
  let y = Math.atan2(Math.tan(phi), Math.cos(lambda - this.lam0)) - this.phi0;
  if ( y < -Math.PI || Math.PI <= y ) {
    y -= 2 * Math.PI * Math.floor((y + Math.PI) / (2*Math.PI));
  }
  return {x: x, y: y};
};


//
ProjTMERC.prototype.inverse = function(x, y) {
  const phi = this.inverse_phi_(x, y);
  let lam = this.inverse_lambda_(x, y);
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
  const cy = Math.cos(y + this.phi0);
  if ( cy === 0.0 ) {
    return (0 <= x) ? Math.PI/2 : -Math.PI/2;
  }
  const sx = Math.sinh(x);
  const v = Math.atan2(sx, cy) + this.lam0;
  if ( cy < 0 && sx < 0 ) {
    return v + 2 * Math.PI;
  } else {
    return v;
  }
};


ProjTMERC.prototype.containsNorthPole_ = function(x_min, y_min, x_max, y_max) {
  if (x_max < 0 || 0 < x_min)  return false;
  //var n = Math.ceil((y_max - y_min) / (2 * Math.PI)) + 1;

  const y0 = (2 * Math.floor((y_min + this.phi0) / (2 * Math.PI) - 0.5) + 0.5) * Math.PI - this.phi0;
  for (let i = 0; i < 256; ++i) {
    const y = y0 + 2 * Math.PI * i;
    if ( y_max < y )   break;
    if ( y_min <= y && y <= y_max )   return true;
  }
  return false;
};


ProjTMERC.prototype.containsSouthPole_ = function(x_min, y_min, x_max, y_max) {
  if (x_max < 0 || 0 < x_min)  return false;
  //var n = Math.ceil((y_max - y_min) / (2 * Math.PI)) + 1;

  const y0 = (2 * Math.floor((y_min + this.phi0) / (2 * Math.PI) + 0.5) - 0.5) * Math.PI - this.phi0;
  for (let i = 0; i < 256; ++i) {
    const y = y0 + 2 * Math.PI * i;
    if ( y_max < y )   break;
    if ( y_min <= y && y <= y_max )   return true;
  }
  return false;
};

//  TODO 要テスト？
ProjTMERC.prototype.inverseBoundingBox = function(x1, y1, x2, y2) {
  const x_min = (x1 <= x2) ? x1 : x2;
  const x_max = (x1 <= x2) ? x2 : x1;
  const y_min = (y1 <= y2) ? y1 : y2;
  const y_max = (y1 <= y2) ? y2 : y1;

  if ( x_min <= 0 && 0 <= x_max ) {
    const containsNorthPole = this.containsNorthPole_(x_min, y_min, x_max, y_max);
    const containsSouthPole = this.containsSouthPole_(x_min, y_min, x_max, y_max);

    //  N極,S極の双方を含む場合
    if ( containsNorthPole && containsSouthPole ) {
      return {lambda: [-Math.PI, +Math.PI], phi: [-Math.PI/2, +Math.PI/2]};
    }
    //  N極,S極のどちらか一方を含む場合
    if ( containsNorthPole || containsSouthPole ) {
      const range = this.inversePhiRange_([x_min, x_max], [y_min, y_max]);
      if ( containsNorthPole ) {
        return {lambda: [-Math.PI, +Math.PI], phi: [range[0], Math.PI/2]};
      } else {
        return {lambda: [-Math.PI, +Math.PI], phi: [-Math.PI/2, range[1]]};
      }
    }
  }
  //  通常ケース
  const phiRange2 = this.inversePhiRange_([x_min, x_max], [y_min, y_max]);
  let lamRange2 = this.inverseLambdaRange_([x_min, x_max], [y_min, y_max]);
  lamRange2 = this.normalizeLambdaRange_(lamRange2);
  if (2 * Math.PI < lamRange2[1] - lamRange2[0]) {
    lamRange2 = [-Math.PI, Math.PI];
  }
  return {lambda: lamRange2, phi: phiRange2};
};

//
ProjTMERC.prototype.mergeRange_ = function(origRange, newRange) {
  let range = null;
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
  const lam = range[0];
  if ( -Math.PI <= lam && lam < Math.PI ) {
    return range;
  }
  const d = 2 * Math.PI * Math.floor( (lam + Math.PI) / (2 * Math.PI) );
  return [range[0] - d, range[1] - d];
};


//
ProjTMERC.prototype.inverseLambdaRange_ = function(xRange, yRange) {
  const x_min = (xRange[0] <= xRange[1]) ? xRange[0] : xRange[1];
  const x_max = (xRange[0] <= xRange[1]) ? xRange[1] : xRange[0];
  const y_min = (yRange[0] <= yRange[1]) ? yRange[0] : yRange[1];
  const y_max = (yRange[0] <= yRange[1]) ? yRange[1] : yRange[0];

  const rangeAtY = this.inverseLambdaRangeAtY_([x_min, x_max], [y_min, y_max]);
  const rangeAtX = this.inverseLambdaRangeAtX_([y_min, y_max], [x_min, x_max]);
  const range = this.mergeRange_(rangeAtX, rangeAtY);

  return range;
};

//
ProjTMERC.prototype.inverseLambdaRangeAtY_ = function(xRange, yValues) {
  const xmin = (xRange[0] <= xRange[1]) ? xRange[0] : xRange[1];
  const xmax = (xRange[0] <= xRange[1]) ? xRange[1] : xRange[0];

  const across = (xmin <= 0) && (0 <= xmax);

  const numY = yValues.length;
  let lam_min = null;
  let lam_max = null;

  for (let k = 0; k < numY; k++) {
    const y = yValues[k];

    let v = across ? this.inverse_lambda_atY_(xmin, y) : this.inverse_lambda_(xmin, y);
    if (lam_min === null || v < lam_min)  lam_min = v;
    if (lam_max === null || lam_max < v)  lam_max = v;

    v = across ? this.inverse_lambda_atY_(xmax, y) : this.inverse_lambda_(xmax, y);
    if (v < lam_min)  lam_min = v;
    if (lam_max < v)  lam_max = v;
  }

  if ( lam_min < -Math.PI || Math.PI <= lam_min ) {
    const dlam = 2 * Math.PI * Math.floor((lam_min + Math.PI) / (2*Math.PI));
    lam_min -= dlam;
    lam_max -= dlam;
  }
  return [lam_min, lam_max];
};

//
ProjTMERC.prototype.inverseLambdaRangeAtX_ = function(yRange, xValues) {
  const ymin = (yRange[0] <= yRange[1]) ? yRange[0] : yRange[1];
  const ymax = (yRange[0] <= yRange[1]) ? yRange[1] : yRange[0];

  const y0 = Math.PI * Math.floor((ymin + this.phi0)/ Math.PI) - this.phi0;

  const numX = xValues.length;
  let lam_min = null;
  let lam_max = null;

  for (let k = 0; k < numX; k++) {
    const x = xValues[k];

    let v = this.inverse_lambda_(x, ymin);
    if (lam_min === null || v < lam_min)  lam_min = v;
    if (lam_max === null || lam_max < v)  lam_max = v;

    v = this.inverse_lambda_(x, ymax);
    if (v < lam_min)  lam_min = v;
    if (lam_max < v)  lam_max = v;

    //  極値のチェック
    for (let i = 1; i <= 2; i++) {
      const y = y0 + Math.PI * i;
      //if (y < ymin)  throw new Error('assert!!');  //  TODO assert!!
      if (ymax < y)   break;
      v = this.inverse_lambda_(x, y);
      if (v < lam_min)  lam_min = v;
      if (lam_max < v)  lam_max = v;
    }
  }

  if ( lam_min < -Math.PI || Math.PI <= lam_min ) {
    const dlam = 2 * Math.PI * Math.floor((lam_min + Math.PI) / (2*Math.PI));
    lam_min -= dlam;
    lam_max -= dlam;
  }
  return [lam_min, lam_max];
};

//
ProjTMERC.prototype.inversePhiRange_ = function(xRange, yRange) {
  const x_min = (xRange[0] <= xRange[1]) ? xRange[0] : xRange[1];
  const x_max = (xRange[0] <= xRange[1]) ? xRange[1] : xRange[0];
  const y_min = (yRange[0] <= yRange[1]) ? yRange[0] : yRange[1];
  const y_max = (yRange[0] <= yRange[1]) ? yRange[1] : yRange[0];

  const rangeAtY = this.inversePhiRangeAtY_([x_min, x_max], [y_min, y_max]);
  const rangeAtX = this.inversePhiRangeAtX_([y_min, y_max], [x_min, x_max]);
  const range = this.mergeRange_(rangeAtX, rangeAtY);

  return range;
};


//
ProjTMERC.prototype.inversePhiRangeAtY_ = function(xRange, yValues) {
  const xmin = (xRange[0] <= xRange[1]) ? xRange[0] : xRange[1];
  const xmax = (xRange[0] <= xRange[1]) ? xRange[1] : xRange[0];

  const numY = yValues.length;
  let phi_min = null;
  let phi_max = null;

  for (let k = 0; k < numY; k++) {
    const y = yValues[k];

    let v = this.inverse_phi_(xmin, y);
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
  const ymin = (yRange[0] <= yRange[1]) ? yRange[0] : yRange[1];
  const ymax = (yRange[0] <= yRange[1]) ? yRange[1] : yRange[0];

  const y0 = Math.PI * (Math.floor((ymin + this.phi0)/ Math.PI + 0.5) - 0.5) - this.phi0;

  const numX = xValues.length;
  let phi_min = null;
  let phi_max = null;

  for (let k = 0; k < numX; k++) {
    const x = xValues[k];

    let v = this.inverse_phi_(x, ymin);
    if (phi_min === null || v < phi_min)  phi_min = v;
    if (phi_max === null || phi_max < v)  phi_max = v;

    v = this.inverse_phi_(x, ymax);
    if (v < phi_min)  phi_min = v;
    if (phi_max < v)  phi_max = v;

    //  極値のチェック
    for (let i = 1; i <= 2; i++) {
      const y = y0 + Math.PI * i;
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

  'uniform float uPointSize;',
  'uniform lowp int uCoordType;',      // 入力座標系種別  0: Data Coordinates, 1: XY Coordinates, 2: Screen
  'uniform lowp int uTextureType;',    //  0:NotUse, 1:PointTexture, 2:SurfaceTexture

  'const float pi = 3.141592653589793;',
  //'const float epsilon = 0.00000001;',
  'const float epsilon = 0.001;',

//  'vec2 proj_forward(vec2 center, vec2 lp, float baseY)',
  'vec2 proj_forward(vec2 center, vec2 lp)',
  '{',
  '  float b = cos(lp.y) * sin(lp.x - center.x);',
  '  float x = log((1.0 + b) / (1.0 - b)) / 2.0;',    //  = arctanh(B)
  '  float y = atan(tan(lp.y), cos(lp.x - center.x));',
//  '  float dy = y - baseY + pi;',
//  '  if ( dy < 0.0 || 2.0*pi <= dy ) {',       //  この正規化の処理がない場合は緯度線で不正な縦線が生じることを確認済み(05/21)
//  '    y = y - 2.0*pi * floor(dy / (2.0*pi));',
//  '  }',
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
//  '    vec2 xy = proj_forward(uProjCenter, vec2(aCoordX, aCoordY), uBaseY);',
  '    vec2 xy = proj_forward(uProjCenter, vec2(aCoordX, aCoordY));',
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
  'uniform vec2 uCanvasSize;',
  'uniform float uGraticuleIntervalDeg;',   //  緯度経度線の描画間隔[degrees]
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

  'float validate_xy(vec2 xy)',
  '{',
  '  return 1.0;',
  '}',

  //  緯度経度線描画のための関数
  'vec2 graticule_level(vec2 lp, vec2 baseLonLat) {',
  '  vec2 lonlat = degrees(lp);',
  '  if ( 135.0 < abs(baseLonLat.x) ) {',
  '    lonlat.x = mod(lonlat.x + 360.0, 360.0);',     //  連続性を保つため日付変更線付近では基準を変更
  '  }',
  '  return floor(lonlat / uGraticuleIntervalDeg);',
  '}',

  //   緯度経度線描画
  'bool render_graticule() {',
  '  vec2 viewCoord = (uInvTransform * vec3(vCoord.x, vCoord.y, 1.0)).xy;',
  '  if ( validate_xy(viewCoord) == 0.0 ) {',
  '    return false;',
  '  }',

  '  vec2 lp = proj_inverse(uProjCenter, viewCoord);',                 //  緯度経度
  '  vec2 baseLonLat = degrees(lp);',      //  該当ピクセルの緯度経度
  '  float absLat = abs(baseLonLat.y);',
  '  if (81.0 < absLat) {',
  '    return false;',   //  両極付近は描画対象外
  '  }',

  '  vec2 v1 = (uInvTransform * vec3(vCoord.x, vCoord.y + 1.0/uCanvasSize.y, 1.0)).xy;',
  '  vec2 v3 = (uInvTransform * vec3(vCoord.x - 1.0/uCanvasSize.x, vCoord.y, 1.0)).xy;',
  '  vec2 v5 = (uInvTransform * vec3(vCoord.x + 1.0/uCanvasSize.x, vCoord.y, 1.0)).xy;',
  '  vec2 v7 = (uInvTransform * vec3(vCoord.x, vCoord.y - 1.0/uCanvasSize.y, 1.0)).xy;',

  '  if ( validate_xy(v1) == 0.0 ||  validate_xy(v3) == 0.0 || validate_xy(v5) == 0.0 || validate_xy(v7) == 0.0) {',
  '    return false;',
  '  }',

  '  vec2 z = -4.0 * graticule_level(lp, baseLonLat);',
  '  z += graticule_level(proj_inverse(uProjCenter, v1), baseLonLat);',
  '  z += graticule_level(proj_inverse(uProjCenter, v3), baseLonLat);',
  '  z += graticule_level(proj_inverse(uProjCenter, v5), baseLonLat);',
  '  z += graticule_level(proj_inverse(uProjCenter, v7), baseLonLat);',

  '  vec2 col = min(abs(z) / 1.9, 1.0);',
  '  float alpha = 0.0;',
  '  if (80.0 < absLat) {',
  '    alpha = col.y;',    //  ±80度より極付近は経線は描画しない
  '  } else {',
  '    alpha = max(col.x, col.y);',
  '  }',

  '  if (alpha == 0.0) {',
  '    return false;',
  '  }',

  '  vec3 lineColor = vec3(0.8);',
  '  gl_FragColor = vec4(lineColor, alpha * 0.75);',

  '  return true;',
  '}',

  'void main()',
  '{',
  '  if ( vInRange < 0.5 ) {',
  '    discard;',
  '    return;',
  '  }',

  '  if ( 0.0 < uGraticuleIntervalDeg ) {',
  '    bool rendered = render_graticule();',
  '    if ( !rendered ) {',
  '      discard;',
  '    }',
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
