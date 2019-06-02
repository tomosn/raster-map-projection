/**
 * Raster Map Projection v0.0.29  2019-06-02
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
ProjTMERC.RANGE_RECTANGLE = { x1:-Math.PI, y1:-Math.PI, x2:+Math.PI, y2:+Math.PI };

ProjTMERC.prototype.getRange = function() {
  return Object.assign({}, ProjTMERC.RANGE_RECTANGLE);
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
/**
 * inverse bounding box
 * @param {Rectangle} rect
 * @return {Object}
 */
ProjTMERC.prototype.inverseBoundingBox = function(rect) {
  const x_min = (rect.x1 <= rect.x2) ? rect.x1 : rect.x2;
  const x_max = (rect.x1 <= rect.x2) ? rect.x2 : rect.x1;
  const y_min = (rect.y1 <= rect.y2) ? rect.y1 : rect.y2;
  const y_max = (rect.y1 <= rect.y2) ? rect.y2 : rect.y1;

  if ( x_min <= 0 && 0 <= x_max ) {
    const containsNorthPole = this.containsNorthPole_(x_min, y_min, x_max, y_max);
    const containsSouthPole = this.containsSouthPole_(x_min, y_min, x_max, y_max);

    //  N極,S極の双方を含む場合
    if ( containsNorthPole && containsSouthPole ) {
      return { lambda1:-Math.PI, lambda2:+Math.PI, phi1:-Math.PI/2, phi2:+Math.PI/2 };
    }
    //  N極,S極のどちらか一方を含む場合
    if ( containsNorthPole || containsSouthPole ) {
      const range = this.inversePhiRange_([x_min, x_max], [y_min, y_max]);
      if ( containsNorthPole ) {
        return { lambda1:-Math.PI, lambda2:+Math.PI, phi1:range[0], phi2:Math.PI/2 };
      } else {
        return { lambda1:-Math.PI, lambda2:+Math.PI, phi1:-Math.PI/2, phi2:range[1] };
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
  return { lambda1:lamRange2[0], lambda2:lamRange2[1], phi1:phiRange2[0], phi2:phiRange2[1] };
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
  'uniform lowp int uCoordType;',
  'uniform lowp int uTextureType;',

  'const float pi = 3.141592653589793;',
  'const float epsilon = 0.001;',

  'vec2 proj_forward(vec2 center, vec2 lp) {',
  '  float b = cos(lp.y) * sin(lp.x - center.x);',
  '  float x = log((1.0 + b) / (1.0 - b)) / 2.0;',
  '  float y = atan(tan(lp.y), cos(lp.x - center.x));',
  '  return vec2(x, y - center.y);',
  '}',

  'float check_xy_range(vec2 xy) {',
  '  return step(-pi, xy.x) - step(pi, xy.x);',
  '}',

  'void main() {',
  '  vInRange;',
  '  vec3 pos;',

  '  if ( uTextureType == 2 || uCoordType == 2 ) {',
  '    vInRange = 1.0;',
  '    pos = vec3(aCoordX, aCoordY, 1.0);',

  '  } else if ( uCoordType == 1 ) {',
  '    vInRange = check_xy_range(vec2(aCoordX, aCoordY));',
  '    pos = uFwdTransform * vec3(aCoordX, aCoordY, 1.0);',

  '  } else {',
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
  'uniform lowp int uCoordType;',
  'uniform lowp int uTextureType;',
  'uniform vec2 uCanvasSize;',
  'uniform float uGraticuleIntervalDeg;',
  'uniform sampler2D uTexture;',
  'uniform vec2 uProjCenter;',
  'uniform vec4 uColor;',
  'uniform float uOpacity;',

  'varying vec2 vCoord;',
  'varying float vInRange;',

  'const float pi = 3.141592653589793;',
  'const float epsilon = 0.00000001;',
  'const float blurRatio = 0.015;',

  'vec2 proj_inverse(vec2 center, vec2 xy) {',
  '  float d = xy.y + center.y;',

  '  float ep = exp(xy.x);',
  '  float em = exp(-xy.x);',
  '  float ch = (ep + em) / 2.0;',
  '  float sh = (ep - em) / 2.0;',

  '  float phi = asin( clamp( sin(d) / ch, -1.0, 1.0 ) );',
  '  float lam = mod( center.x + atan( sh, cos(d) ) + pi, 2.0 * pi ) - pi;',

  '  return vec2(lam, phi);',
  '}',

  'float inner_xy(vec2 xy) {',
  '  return 1.0;',
  '}',

  'float validate_xy(vec2 xy) {',
  '  return 1.0;',
  '}',


  'vec2 graticule_level(vec2 lp, bool isNearDateLine) {',
  '  vec2 lonlat = degrees(lp);',
  '  if ( isNearDateLine ) {',
  '    lonlat.x = mod(lonlat.x + 360.0, 360.0);',
  '  }',
  '  return floor(lonlat / uGraticuleIntervalDeg);',
  '}',


  'void render_graticule() {',
  '  vec2 viewCoord = (uInvTransform * vec3(vCoord.x, vCoord.y, 1.0)).xy;',
  '  if ( validate_xy(viewCoord) == 0.0 ) {',
  '    discard;',
  '    return;',
  '  }',

  '  vec2 lp = proj_inverse(uProjCenter, viewCoord);',
  '  vec2 baseLonLat = degrees(lp);',
  '  float absLat = abs(baseLonLat.y);',
  '  if (81.0 < absLat) {',
  '    discard;',
  '    return;',
  '  }',

  '  float dx = 0.5 / uCanvasSize.x;',
  '  float dy = 0.5 / uCanvasSize.y;',

  '  vec2 tv = (uInvTransform * vec3(vCoord.x, vCoord.y, 1.0)).xy;',
  '  vec2 tdx = uInvTransform[0].xy * dx;',
  '  vec2 tdy = uInvTransform[1].xy * dy;',

  '  vec2 v01 = tv - 3.0 * tdx + 1.0 * tdy;',
  '  vec2 v02 = tv - 3.0 * tdx - 1.0 * tdy;',

  '  vec2 v10 = tv - 1.0 * tdx + 3.0 * tdy;',
  '  vec2 v11 = tv - 1.0 * tdx + 1.0 * tdy;',
  '  vec2 v12 = tv - 1.0 * tdx - 1.0 * tdy;',
  '  vec2 v13 = tv - 1.0 * tdx - 3.0 * tdy;',

  '  vec2 v20 = tv + 1.0 * tdx + 3.0 * tdy;',
  '  vec2 v21 = tv + 1.0 * tdx + 1.0 * tdy;',
  '  vec2 v22 = tv + 1.0 * tdx - 1.0 * tdy;',
  '  vec2 v23 = tv + 1.0 * tdx - 3.0 * tdy;',

  '  vec2 v31 = tv + 3.0 * tdx + 1.0 * tdy;',
  '  vec2 v32 = tv + 3.0 * tdx - 1.0 * tdy;',

  '  if ( validate_xy(v01) == 0.0 ||  validate_xy(v02) == 0.0 || validate_xy(v31) == 0.0 || validate_xy(v32) == 0.0) {',
  '    discard;',
  '    return;',
  '  }',
  '  if ( validate_xy(v10) == 0.0 ||  validate_xy(v11) == 0.0 || validate_xy(v12) == 0.0 || validate_xy(v13) == 0.0) {',
  '    discard;',
  '    return;',
  '  }',
  '  if ( validate_xy(v20) == 0.0 ||  validate_xy(v21) == 0.0 || validate_xy(v22) == 0.0 || validate_xy(v23) == 0.0) {',
  '    discard;',
  '    return;',
  '  }',

  '  bool isNearDateLine = ( 135.0 < abs(baseLonLat.x) );',

  '  vec2 l01 = graticule_level(proj_inverse(uProjCenter, v01), isNearDateLine);',
  '  vec2 l02 = graticule_level(proj_inverse(uProjCenter, v02), isNearDateLine);',

  '  vec2 l10 = graticule_level(proj_inverse(uProjCenter, v10), isNearDateLine);',
  '  vec2 l11 = graticule_level(proj_inverse(uProjCenter, v11), isNearDateLine);',
  '  vec2 l12 = graticule_level(proj_inverse(uProjCenter, v12), isNearDateLine);',
  '  vec2 l13 = graticule_level(proj_inverse(uProjCenter, v13), isNearDateLine);',

  '  vec2 l20 = graticule_level(proj_inverse(uProjCenter, v20), isNearDateLine);',
  '  vec2 l21 = graticule_level(proj_inverse(uProjCenter, v21), isNearDateLine);',
  '  vec2 l22 = graticule_level(proj_inverse(uProjCenter, v22), isNearDateLine);',
  '  vec2 l23 = graticule_level(proj_inverse(uProjCenter, v23), isNearDateLine);',

  '  vec2 l31 = graticule_level(proj_inverse(uProjCenter, v31), isNearDateLine);',
  '  vec2 l32 = graticule_level(proj_inverse(uProjCenter, v32), isNearDateLine);',

  '  vec2 z11 = -4.0 * l11 + l01 + l10 + l21 + l12;',
  '  vec2 z21 = -4.0 * l21 + l11 + l20 + l31 + l22;',
  '  vec2 z12 = -4.0 * l12 + l02 + l11 + l22 + l13;',
  '  vec2 z22 = -4.0 * l22 + l12 + l21 + l32 + l23;',

  '  vec2 col = (min(abs(z11), 1.0) + min(abs(z21), 1.0) + min(abs(z12), 1.0) + min(abs(z22), 1.0)) * 0.25;',
  '  float alpha = 0.0;',
  '  if (80.0 < absLat) {',
  '    alpha = col.y;',
  '  } else {',
  '    alpha = max(col.x, col.y);',
  '  }',

  '  if (alpha == 0.0) {',
  '    discard;',
  '    return;',
  '  }',

  '  vec3 lineColor = vec3(0.8);',
  '  gl_FragColor = vec4(lineColor, alpha * 0.75);',
  '}',


  'void render_surface_texture() {',
  '  float inXY = 1.0;',
  '  vec2 coord;',
  '  if ( uCoordType == 2 ) {',
  '    coord = vCoord;',

  '  } else if ( uCoordType == 1 ) {',
  '    coord = (uInvTransform * vec3(vCoord.x, vCoord.y, 1.0)).xy;',
  '    inXY = inner_xy(coord);',
  '    if ( inXY <= 0.0 ) {',
  '      discard;',
  '      return;',
  '    }',

  '  } else if ( uCoordType == 0 ) {',
  '    vec2 viewCoord = (uInvTransform * vec3(vCoord.x, vCoord.y, 1.0)).xy;',
  '    inXY = inner_xy(viewCoord);',
  '    if ( inXY <= 0.0 ) {',
  '      discard;',
  '      return;',
  '    }',
  '    coord = proj_inverse(uProjCenter, viewCoord);',

  '  }',

  '  vec2 ts = (coord - uDataCoord1) / (uDataCoord2 - uDataCoord1);',
  '  if ( all(lessThanEqual(uClipCoord1, ts)) && all(lessThanEqual(ts, uClipCoord2)) ) {',
  '    vec4 outColor = texture2D(uTexture, vec2(ts.x, 1.0 - ts.y)) * inXY;',
  '    outColor.a = outColor.a * uOpacity;',
  '    gl_FragColor = outColor;',

  '  } else {',
  '    discard;',
  '  }',

  '}',


  'void render_point_texture() {',
  '  vec4 outColor = texture2D(uTexture, gl_PointCoord);',
  '  if ( outColor.a == 0.0 ) {',
  '    discard;',
  '    return;',
  '  }',
  '  gl_FragColor = outColor;',
  '}',


  'void render_vector() {',
  '  if ( uColor.a == 0.0 ) {',
  '    discard;',
  '    return;',
  '  }',
  '  gl_FragColor = uColor;',
  '}',


  'void main() {',
  '  if ( vInRange < 0.5 ) {',
  '    discard;',
  '    return;',
  '  }',

  '  if ( 0.0 < uGraticuleIntervalDeg ) {',
  '    render_graticule();',
  '    return;',
  '  }',

  '  if ( uTextureType == 2 ) {',
  '    render_surface_texture();',

  '  } else if ( uTextureType == 1 ) {',
  '    render_point_texture();',

  '  } else {',
  '    render_vector();',

  '  }',
  '}',


].join('\n');

/* -------------------------------------------------------------------------- */
if (typeof module != 'undefined' && module.exports) {
  module.exports = ProjTMERC;
}
