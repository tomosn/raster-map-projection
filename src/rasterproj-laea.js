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
  return new ProjLAEA(lam0, phi0, optDivN);
};

// -----------------------------------------------------

/**
 * 区間[-2,2]を等分割して量子化した数学関数
 * @param {number} divN 区間[0,2]の分割数
 * @constructor
 */
var ProjDiscreteMath = function(divN) {
  this.divN_ = divN;
  this.unit_ = 2.0 / divN;
};

ProjDiscreteMath.prototype.toDiscrete = function(t) {
  var idx = Math.floor(t / this.unit_);
  return idx;
};

/*
 * \cos(2 \sin^{-1}(\sqrt{x^2+y^2}/2))
 */
ProjDiscreteMath.prototype.cosR_lower = function(idx, p) {
  var t = (0 <= idx) ? (idx+1) * this.unit_ : -idx * this.unit_;
  var r = Math.sqrt(t * t + p * p);
  return (r <= 2.0) ? Math.cos(2 * Math.asin(r/2)) : -1.0;
};

ProjDiscreteMath.prototype.cosR_upper = function(idx, p) {
  var t = (0 <= idx) ? idx * this.unit_ : (-idx-1) * this.unit_;
  var r = Math.sqrt(t * t + p * p);
  return (r <= 2.0) ? Math.cos(2 * Math.asin(r/2)) : -1.0;
};

/*
 * \sin(2 \sin^{-1}(\sqrt{x^2+y^2}/2))
 */
ProjDiscreteMath.prototype.sinR_lower = function(idx, p) {
  var x1 = idx * this.unit_;
  var x2 = (idx+1) * this.unit_;
  var r1 = Math.sqrt(x1 * x1 + p * p);
  var r2 = Math.sqrt(x2 * x2 + p * p);
  if ( 2.0 <= r1 || 2.0 <= r2 ) return 0.0;
  if ( r1 <= ProjMath.SQRT_2 && r2 <= ProjMath.SQRT_2 ) {
    var minr = Math.min(r1, r2);
    return Math.sin(2 * Math.asin(minr/2));
  }
  if ( ProjMath.SQRT_2 <= r1 && ProjMath.SQRT_2 <= r2 ) {
    var maxr = Math.max(r1, r2);
    return Math.sin(2 * Math.asin(maxr/2));
  }
  var v1 = Math.sin(2 * Math.asin(r1/2));
  var v2 = Math.sin(2 * Math.asin(r2/2));
  return (v1 < v2) ? v1 : v2;
};

ProjDiscreteMath.prototype.sinR_upper = function(idx, p) {
  var x1 = idx * this.unit_;
  var x2 = (idx+1) * this.unit_;
  var r1 = Math.sqrt(x1 * x1 + p * p);
  var r2 = Math.sqrt(x2 * x2 + p * p);
  if ( 2.0 <= r1 && 2.0 <= r2 ) return 0.0;
  if ( r1 <= ProjMath.SQRT_2 && r2 <= ProjMath.SQRT_2 ) {
    var maxr = Math.max(r1, r2);
    return Math.sin(2 * Math.asin(maxr/2));
  }
  if ( ProjMath.HALF_PI <= r1 && ProjMath.HALF_PI <= r2 ) {
    var minr = Math.min(r1, r2);
    return Math.sin(2 * Math.asin(minr/2));
  }
  return 1.0;
};

/**
 * \sqrt{x^2+y^2} \cot(2 \sin^{-1}(\sqrt{x^2+y^2}/2))
 */
ProjDiscreteMath.prototype.R_cotR_lower = function(idx, p) {
  var t = (0 <= idx) ? (idx+1) * this.unit_ : -idx * this.unit_;
  var r = Math.sqrt(t * t + p * p);
  if ( r < ProjMath.EPSILON )  return 1.0;
  return (r < 2.0) ? r / Math.tan(2 * Math.asin(r/2)) : -Infinity;
};

ProjDiscreteMath.prototype.R_cotR_upper = function(idx, p) {
  var t = (0 <= idx) ? idx * this.unit_ : (-idx-1) * this.unit_;
  var r = Math.sqrt(t * t + p * p);
  if ( r < ProjMath.EPSILON )  return 1.0;
  return (r < 2.0) ? r / Math.tan(2 * Math.asin(r/2)) : -Infinity;
};

/**
 * \sin(2 \sin^{-1}(\sqrt{x^2+y^2}/2)) / \sqrt{x^2+y^2}
 */
ProjDiscreteMath.prototype.sinR_divR_lower = function(idx, p) {
  var t = (0 <= idx) ? (idx+1) * this.unit_ : -idx * this.unit_;
  var r = Math.sqrt(t * t + p * p);
  if ( r < ProjMath.EPSILON )  return 1.0;
  return (r < 2.0) ? Math.sin(2 * Math.asin(r/2)) / r : 0.0;
};

ProjDiscreteMath.prototype.sinR_divR_upper = function(idx, p) {
  var t = (0 <= idx) ? idx * this.unit_ : (-idx-1) * this.unit_;
  var r = Math.sqrt(t * t + p * p);
  if ( r < ProjMath.EPSILON )  return 1.0;
  return (r < 2.0) ? Math.sin(2 * Math.asin(r/2)) / r : 0.0;
};


/*
 *
 */
ProjDiscreteMath.prototype.X_lower = function(idx) {
  return idx * this.unit_;
};

ProjDiscreteMath.prototype.X_upper = function(idx) {
  return (idx+1) * this.unit_;
};


/* ------------------------------------------------------------ */

/**
 * Spherical Lambert Azimuthal Equal-Area Projection
 * @param {number} lam0  latitude of the center [rad].
 * @param {number} phi0  longitude of the center [rad].
 * @param {object} option (divN)
 * @constructor
 */
var ProjLAEA = function(lam0, phi0, optDivN) {
  this.lam0 = lam0;
  this.phi0 = phi0;
  this.divN_ = (typeof optDivN !== 'undefined') ? optDivN : 180;
  //
  this.dMath_ = new ProjDiscreteMath(this.divN_);
  this.sin_phi0_ = Math.sin(phi0);
  this.cos_phi0_ = Math.cos(phi0);
};

/**
 * 値域を表す矩形
 */
ProjLAEA.RANGE_RECTANGLE = [-2.0, -2.0, 2.0, 2.0];

/**
 * @return {Object}
 */
ProjLAEA.prototype.getRange = function() {
  return ProjLAEA.RANGE_RECTANGLE.slice(0);
};

/**
 * @return {GeoCoord}
 */
ProjLAEA.prototype.getProjCenter = function() {
  return {lambda: this.lam0, phi: this.phi0};
};

/**
 * @param {Float} lam
 * @param {Float} phi
 */
ProjLAEA.prototype.setProjCenter = function(lam, phi) {
  this.lam0 = lam;
  this.phi0 = phi;
  this.sin_phi0_ = Math.sin(phi);
  this.cos_phi0_ = Math.cos(phi);
};

/**
 * @param {Float} x
 * @param {Float} y
 * @param {Float} rate (option)
 */
ProjLAEA.prototype.checkXYDomain = function(x, y, rate) {
  var lim = 2.0;
  if ( rate != null ) {
    lim *= rate;
  }
  if ( Math.abs(x) < lim && Math.abs(y) < lim ) {
    return true;
  }
  var r2 = x * x + y * y;
  return r2 < lim * lim;
};

/**
 * Forward projection.
 * @param {Float} lambda
 * @param {Float} phi
 * @return {Point}
 */
ProjLAEA.prototype.forward = function(lambda, phi) {
  var sin_phi = Math.sin(phi);
  var cos_phi = Math.cos(phi);
  var sin_lam = Math.sin(lambda - this.lam0);
  var cos_lam = Math.cos(lambda - this.lam0);

  var c = 1 + this.sin_phi0_ * sin_phi + this.cos_phi0_ * cos_phi * cos_lam;
  if ( Math.abs(c) < ProjMath.EPSILON ) {
    return null;  //  対蹠点
  }

  var k = Math.sqrt(2 / c);
  var x = k * cos_phi * sin_lam;
  var y = k * ( this.cos_phi0_ * sin_phi - this.sin_phi0_ * cos_phi * cos_lam );
  return {x: x, y: y};
};

/**
 * Inverse projection.
 * @param {Float} x
 * @param {Float} y
 * @param {GeoCoord}
 */
ProjLAEA.prototype.inverse = function(x, y) {
  var rh2 = x * x + y * y;
  if ( 4.0 < rh2 )   return null;

  var rho = Math.sqrt(rh2);
  if ( rho < ProjMath.EPSILON )  return {lambda: this.lam0, phi: this.phi0};

  var c_rh = 2 * Math.asin(ProjMath.clamp(rho/2, -1, 1));

  var sin_c = Math.sin(c_rh);
  var cos_c = Math.cos(c_rh);

  var sinPhi = cos_c * this.sin_phi0_ + y * sin_c * this.cos_phi0_ / rho;
  var phi = Math.asin(ProjMath.clamp(sinPhi, -1, 1));
  var lam;
  if ( ProjMath.HALF_PI - ProjMath.EPSILON < this.phi0 ) {   //  phi0 = pi/2
    lam = Math.atan2(x, -y) + this.lam0;
  } else if ( this.phi0 < -(ProjMath.HALF_PI - ProjMath.EPSILON) ) {   //  phi0 = -pi/2
    lam = Math.atan2(x, y) + this.lam0;
  } else {
    lam = Math.atan2(x * sin_c, rho * cos_c * this.cos_phi0_ - y * this.sin_phi0_ * sin_c) + this.lam0;
  }

  if ( lam < -Math.PI || Math.PI <= lam ) {
    lam -= 2 * Math.PI * Math.floor((lam + Math.PI) / (2*Math.PI));
  }
  return {lambda: lam, phi: phi};
};

ProjLAEA.prototype.inverseBoundingBox = function(x1, y1, x2, y2) {
  var x_min = (x1 <= x2) ? x1 : x2;
  var x_max = (x1 <= x2) ? x2 : x1;
  var y_min = (y1 <= y2) ? y1 : y2;
  var y_max = (y1 <= y2) ? y2 : y1;

  if ( x_min <= 0 && 0 <= x_max ) {
    var yn = ProjMath.SQRT_2 * this.cos_phi0_ / Math.sqrt(1 + this.sin_phi0_);
    var containsNorthPole =
        ( -(ProjMath.HALF_PI - ProjMath.EPSILON) < this.phi0 ) && (y_min <= yn) && (yn <= y_max);

    var ys = - ProjMath.SQRT_2 * this.cos_phi0_ / Math.sqrt(1 - this.sin_phi0_);
    var containsSouthPole =
        ( this.phi0 < ProjMath.HALF_PI - ProjMath.EPSILON ) && (y_min <= ys) && (ys <= y_max);

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

    //  N極から上方への半直線、あるいはS極から下方への半直線を跨ぐ場合
    if ( y_max < ys || yn < y_min ) {
      var rangeMinus1 = this.inverseLambdaRangeAtY_([x_min, -ProjMath.EPSILON], [y_min, y_max]);
      var rangeMinus2 = this.inverseLambdaRangeAtX_([y_min, y_max], [x_min]);
      var rangePlus1 = this.inverseLambdaRangeAtY_([ProjMath.EPSILON, x_max], [y_min, y_max]);
      var rangePlus2 = this.inverseLambdaRangeAtX_([y_min, y_max], [x_max]);

      var rangeMinus = this.mergeRange_(rangeMinus1, rangeMinus2);
      var rangePlus = this.mergeRange_(rangePlus1, rangePlus2);

      var lamRange1 = [rangePlus[0], rangeMinus[1] + 2 * Math.PI];
      var phiRange1 = this.inversePhiRange_([x_min, x_max], [y_min, y_max]);
      lamRange1 = this.normalizeLambdaRange_(lamRange1);
      return {lambda: lamRange1, phi: phiRange1};
    }
  }

  //  通常ケース
  var phiRange2 = this.inversePhiRange_([x_min, x_max], [y_min, y_max]);
  var lamRange2 = this.inverseLambdaRange_([x_min, x_max], [y_min, y_max]);
  lamRange2 = this.normalizeLambdaRange_(lamRange2);
  return {lambda: lamRange2, phi: phiRange2};
};


ProjLAEA.prototype.mergeRange_ = function(origRange, newRange) {
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


ProjLAEA.prototype.normalizeLambdaRange_ = function(range) {
  var lam = range[0];
  if ( -Math.PI <= lam && lam < Math.PI ) {
    return range;
  }
  var d = 2 * Math.PI * Math.floor( (lam + Math.PI) / (2 * Math.PI) );
  return [range[0] - d, range[1] - d];
};


ProjLAEA.prototype.inverseLambdaRange_ = function(xRange, yRange) {
  var x_min = (xRange[0] <= xRange[1]) ? xRange[0] : xRange[1];
  var x_max = (xRange[0] <= xRange[1]) ? xRange[1] : xRange[0];
  var y_min = (yRange[0] <= yRange[1]) ? yRange[0] : yRange[1];
  var y_max = (yRange[0] <= yRange[1]) ? yRange[1] : yRange[0];

  var rangeAtY = this.inverseLambdaRangeAtY_([x_min, x_max], [y_min, y_max]);
  var rangeAtX = this.inverseLambdaRangeAtX_([y_min, y_max], [x_min, x_max]);
  var range = this.mergeRange_(rangeAtX, rangeAtY);

  return range;
};


ProjLAEA.prototype.inverseLambdaRangeAtY_ = function(xRange, yValues) {
  var x_min = (xRange[0] <= xRange[1]) ? xRange[0] : xRange[1];
  var x_max = (xRange[0] <= xRange[1]) ? xRange[1] : xRange[0];

  var range = null;

  var x_idx_min = this.dMath_.toDiscrete(x_min);
  var x_idx_max = this.dMath_.toDiscrete(x_max);

  var numY = yValues.length;

  for ( var x_idx = x_idx_min; x_idx <= x_idx_max; ++x_idx ) {
    for ( var i = 0; i < numY; ++i ) {
      var r = this.inverseLambdaAtY_(x_idx, yValues[i]);
      range = this.mergeRange_(range, r);
    }
  }

  return range;
};


ProjLAEA.prototype.inverseLambdaRangeAtX_ = function(yRange, xValues) {
  var y_min = (yRange[0] <= yRange[1]) ? yRange[0] : yRange[1];
  var y_max = (yRange[0] <= yRange[1]) ? yRange[1] : yRange[0];

  var range = null;

  var y_idx_min = this.dMath_.toDiscrete(y_min);
  var y_idx_max = this.dMath_.toDiscrete(y_max);

  var numX = xValues.length;

  for ( var y_idx = y_idx_min; y_idx <= y_idx_max; ++y_idx ) {
    for ( var i = 0; i < numX; ++i ) {
      var r = this.inverseLambdaAtX_(y_idx, xValues[i]);
      range = this.mergeRange_(range, r);
    }
  }

  return range;
};


ProjLAEA.prototype.inversePhiRange_ = function(xRange, yRange) {
  var x_min = (xRange[0] <= xRange[1]) ? xRange[0] : xRange[1];
  var x_max = (xRange[0] <= xRange[1]) ? xRange[1] : xRange[0];
  var y_min = (yRange[0] <= yRange[1]) ? yRange[0] : yRange[1];
  var y_max = (yRange[0] <= yRange[1]) ? yRange[1] : yRange[0];

  var rangeAtY = this.inversePhiRangeAtY_([x_min, x_max], [y_min, y_max]);
  var rangeAtX = this.inversePhiRangeAtX_([y_min, y_max], [x_min, x_max]);
  var range = this.mergeRange_(rangeAtX, rangeAtY);

  return range;
};


ProjLAEA.prototype.inversePhiRangeAtY_ = function(xRange, yValues) {
  var xmin = (xRange[0] <= xRange[1]) ? xRange[0] : xRange[1];
  var xmax = (xRange[0] <= xRange[1]) ? xRange[1] : xRange[0];

  var range = null;

  var x_idx_min = this.dMath_.toDiscrete(xmin);
  var x_idx_max = this.dMath_.toDiscrete(xmax);

  var numY = yValues.length;

  for ( var x_idx = x_idx_min; x_idx <= x_idx_max; ++x_idx ) {
    for ( var i = 0; i < numY; ++i ) {
      var r = this.inversePhiAtY_(x_idx, yValues[i]);
      range = this.mergeRange_(range, r);
    }
  }

  return range;
};


ProjLAEA.prototype.inversePhiRangeAtX_ = function(yRange, xValues) {
  var ymin = (yRange[0] <= yRange[1]) ? yRange[0] : yRange[1];
  var ymax = (yRange[0] <= yRange[1]) ? yRange[1] : yRange[0];

  var range = null;

  var y_idx_min = this.dMath_.toDiscrete(ymin);
  var y_idx_max = this.dMath_.toDiscrete(ymax);

  var numX = xValues.length;

  for ( var y_idx = y_idx_min; y_idx <= y_idx_max; ++y_idx ) {
    for ( var i = 0; i < numX; ++i ) {
      var r = this.inversePhiAtX_(y_idx, xValues[i]);
      range = this.mergeRange_(range, r);
    }
  }

  return range;
};


ProjLAEA.prototype.inverseLambdaAtX_ = function(y_idx, x) {
  if ( ProjMath.HALF_PI - ProjMath.EPSILON < Math.abs(this.phi0) ) {
    var sign = (0 < this.phi0) ? -1 : +1;
    var yl = sign * this.dMath_.X_lower(y_idx);
    var yu = sign * this.dMath_.X_upper(y_idx);
    var y_max = (yl <= yu) ? yu : yl;
    var y_min = (yl <= yu) ? yl : yu;
    var range = ProjMath.atan2Range({min: x, max: x}, {min: y_min, max: y_max});
    return [range.min + this.lam0, range.max + this.lam0];
  }

  var t1l = this.cos_phi0_ * this.dMath_.R_cotR_lower(y_idx, x);
  var t1u = this.cos_phi0_ * this.dMath_.R_cotR_upper(y_idx, x);
  var t1_max = (t1l <= t1u) ? t1u : t1l;
  var t1_min = (t1l <= t1u) ? t1l : t1u;

  var t2l = - this.sin_phi0_ * this.dMath_.X_lower(y_idx);
  var t2u = - this.sin_phi0_ * this.dMath_.X_upper(y_idx);
  var t2_max = (t2l <= t2u) ? t2u : t2l;
  var t2_min = (t2l <= t2u) ? t2l : t2u;

  var t_max = t1_max + t2_max;
  var t_min = t1_min + t2_min;

  var r = ProjMath.atan2Range({min: x, max: x}, {min: t_min, max: t_max});
  return [r.min + this.lam0, r.max + this.lam0];
};


ProjLAEA.prototype.inverseLambdaAtY_ = function(x_idx, y) {
  if ( ProjMath.HALF_PI - ProjMath.EPSILON < Math.abs(this.phi0) ) {
    var sign = (0 < this.phi0) ? -1 : +1;
    var x_min = this.dMath_.X_lower(x_idx);
    var x_max = this.dMath_.X_upper(x_idx);
    var range = ProjMath.atan2Range({min: x_min, max: x_max}, {min: sign * y, max: sign * y});
    return [range.min + this.lam0, range.max + this.lam0];
  }
  var t1 = this.cos_phi0_ * this.dMath_.R_cotR_lower(x_idx, y) - this.sin_phi0_ * y;
  var t2 = this.cos_phi0_ * this.dMath_.R_cotR_upper(x_idx, y) - this.sin_phi0_ * y;
  var t_max = (t2 <= t1) ? t1 : t2;
  var t_min = (t2 <= t1) ? t2 : t1;

  var s_min = this.dMath_.X_lower(x_idx);
  var s_max = this.dMath_.X_upper(x_idx);

  var r = ProjMath.atan2Range({min: s_min, max: s_max}, {min: t_min, max: t_max});
  return [r.min + this.lam0, r.max + this.lam0];
};


ProjLAEA.prototype.inversePhiAtY_ = function(x_idx, y) {
  var t1l = this.dMath_.cosR_lower(x_idx, y) * this.sin_phi0_;
  var t1u = this.dMath_.cosR_upper(x_idx, y) * this.sin_phi0_;
  var t1_max = (t1l <= t1u) ? t1u : t1l;
  var t1_min = (t1l <= t1u) ? t1l : t1u;

  var t2l = y * this.dMath_.sinR_divR_lower(x_idx, y) * this.cos_phi0_;
  var t2u = y * this.dMath_.sinR_divR_upper(x_idx, y) * this.cos_phi0_;
  var t2_max = (t2l <= t2u) ? t2u : t2l;
  var t2_min = (t2l <= t2u) ? t2l : t2u;

  var t_max = ProjMath.clamp(t1_max + t2_max, -1, 1);
  var t_min = ProjMath.clamp(t1_min + t2_min, -1, 1);

  return [Math.asin(t_min), Math.asin(t_max)];
};


ProjLAEA.prototype.inversePhiAtX_ = function(y_idx, x) {
  var t1l = this.dMath_.cosR_lower(y_idx, x) * this.sin_phi0_;
  var t1u = this.dMath_.cosR_upper(y_idx, x) * this.sin_phi0_;
  var t1_max = (t1l <= t1u) ? t1u : t1l;
  var t1_min = (t1l <= t1u) ? t1l : t1u;

  var y1_abs = Math.abs(this.dMath_.X_lower(y_idx));
  var y2_abs = Math.abs(this.dMath_.X_upper(y_idx));
  var y_abs_max = (y1_abs <= y2_abs) ? y2_abs : y1_abs;
  var y_abs_min = (y1_abs <= y2_abs) ? y1_abs : y2_abs;

  var cos_phi0_abs = Math.abs(this.cos_phi0_);
  var t2_abs_max = y_abs_max * this.dMath_.sinR_divR_upper(y_idx, x) * cos_phi0_abs;
  var t2_abs_min = y_abs_min * this.dMath_.sinR_divR_lower(y_idx, x) * cos_phi0_abs;

  var t2_sign = (0 <= y_idx * this.cos_phi0_) ? +1 : -1;
  var t2_max = (0 < t2_sign) ? +t2_abs_max : -t2_abs_min;
  var t2_min = (0 < t2_sign) ? +t2_abs_min : -t2_abs_max;

  var t_max = ProjMath.clamp(t1_max + t2_max, -1, 1);
  var t_min = ProjMath.clamp(t1_min + t2_min, -1, 1);

  return [Math.asin(t_min), Math.asin(t_max)];
};


/**
 * @return String
 */
ProjLAEA.prototype.getVertexShaderStr = function() {
  return ProjLAEA.VERTEX_SHADER_STR;
};

/**
 * @return String
 */
ProjLAEA.prototype.getFragmentShaderStr = function() {
  return ProjLAEA.FRAGMENT_SHADER_STR;
};

/**
 *
 */
ProjLAEA.VERTEX_SHADER_STR = [

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
  'const float xyDomain = 0.86 * 0.707106781 * pi;',   //  range: PI/sqrt(2)

  'vec2 proj_forward(vec2 center, vec2 lp)',
  '{',
  '  float sinPhi0 = sin(center.y);',
  '  float cosPhi0 = cos(center.y);',

  '  float sinPhi = sin(lp.y);',
  '  float cosPhi = cos(lp.y);',
  '  float sinLam = sin(lp.x - center.x);',
  '  float cosLam = cos(lp.x - center.x);',

  '  float v = sinPhi0 * sinPhi + cosPhi0 * cosPhi * cosLam;',

  '  float x = cosPhi * sinLam;',
  '  float y = cosPhi0 * sinPhi - sinPhi0 * cosPhi * cosLam;',

  '  if ( v < -1.0 + epsilon ) {',
  '    return 2.0 * normalize(vec2(x, y));',   //  対蹠点
  '  }',

  '  float k = sqrt(2.0 / (1.0 + v));',

  '  return k * vec2(x, y);',
  '}',

  'float check_xy_range(vec2 xy)',
  '{',
  '  return 1.0 - step(xyDomain, length(xy));',
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
ProjLAEA.FRAGMENT_SHADER_STR = [

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
  'const float blurRatio = 0.015;',
  'const float xyRadius = 2.0;',

  'vec2 proj_inverse(vec2 center, vec2 xy)',
  '{',
  '  float sinPhi0 = sin(center.y);',
  '  float cosPhi0 = cos(center.y);',

  '  float rho = length(xy);',

  '  if ( rho < epsilon ) {',
  '    return center;',
  '  }',
  '  if ( rho - epsilon > xyRadius ) {',
  '    rho = xyRadius;',
  '  }',

  '  float c_rh = 2.0 * asin( clamp( rho/2.0, -1.0, 1.0) );',

  '  float cos_c = cos(c_rh);',
  '  float sin_c = sin(c_rh);',

  '  float phi = asin( clamp( cos_c * sinPhi0 + xy.y * sin_c * cosPhi0 / rho, -1.0, 1.0 ) );',
  '  float lam = mod( center.x + atan( xy.x * sin_c, rho * cosPhi0 * cos_c - xy.y * sinPhi0 * sin_c ) + pi, 2.0 * pi ) - pi;',

  '  return vec2(lam, phi);',
  '}',

  'float inner_xy(vec2 xy)',
  '{',
  '  return 1.0 - smoothstep( (1.0 - blurRatio) * xyRadius, (1.0 + blurRatio) * xyRadius, length(xy) );',
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
  module.exports = ProjLAEA;
  module.exports.ProjDiscreteMath = ProjDiscreteMath;
}
