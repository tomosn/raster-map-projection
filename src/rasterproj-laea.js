/**
 * Raster Map Projection v0.0.28  2019-04-08
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
  return new ProjLAEA(lam0, phi0, optDivN);
};

// -----------------------------------------------------

/**
 * 区間[-2,2]を等分割して量子化した数学関数
 * @param {number} divN 区間[0,2]の分割数
 * @constructor
 */
function ProjDiscreteMath(divN) {
  this.divN_ = divN;
  this.unit_ = 2.0 / divN;
}

ProjDiscreteMath.prototype.toDiscrete = function(t) {
  const idx = Math.floor(t / this.unit_);
  return idx;
};

/*
 * \cos(2 \sin^{-1}(\sqrt{x^2+y^2}/2))
 */
ProjDiscreteMath.prototype.cosR_lower = function(idx, p) {
  const t = (0 <= idx) ? (idx+1) * this.unit_ : -idx * this.unit_;
  const r = Math.sqrt(t * t + p * p);
  return (r <= 2.0) ? Math.cos(2 * Math.asin(r/2)) : -1.0;
};

ProjDiscreteMath.prototype.cosR_upper = function(idx, p) {
  const t = (0 <= idx) ? idx * this.unit_ : (-idx-1) * this.unit_;
  const r = Math.sqrt(t * t + p * p);
  return (r <= 2.0) ? Math.cos(2 * Math.asin(r/2)) : -1.0;
};

/*
 * \sin(2 \sin^{-1}(\sqrt{x^2+y^2}/2))
 */
ProjDiscreteMath.prototype.sinR_lower = function(idx, p) {
  const x1 = idx * this.unit_;
  const x2 = (idx+1) * this.unit_;
  const r1 = Math.sqrt(x1 * x1 + p * p);
  const r2 = Math.sqrt(x2 * x2 + p * p);
  if ( 2.0 <= r1 || 2.0 <= r2 ) return 0.0;
  if ( r1 <= ProjMath.SQRT_2 && r2 <= ProjMath.SQRT_2 ) {
    const minr = Math.min(r1, r2);
    return Math.sin(2 * Math.asin(minr/2));
  }
  if ( ProjMath.SQRT_2 <= r1 && ProjMath.SQRT_2 <= r2 ) {
    const maxr = Math.max(r1, r2);
    return Math.sin(2 * Math.asin(maxr/2));
  }
  const v1 = Math.sin(2 * Math.asin(r1/2));
  const v2 = Math.sin(2 * Math.asin(r2/2));
  return (v1 < v2) ? v1 : v2;
};

ProjDiscreteMath.prototype.sinR_upper = function(idx, p) {
  const x1 = idx * this.unit_;
  const x2 = (idx+1) * this.unit_;
  const r1 = Math.sqrt(x1 * x1 + p * p);
  const r2 = Math.sqrt(x2 * x2 + p * p);
  if ( 2.0 <= r1 && 2.0 <= r2 ) return 0.0;
  if ( r1 <= ProjMath.SQRT_2 && r2 <= ProjMath.SQRT_2 ) {
    const maxr = Math.max(r1, r2);
    return Math.sin(2 * Math.asin(maxr/2));
  }
  if ( ProjMath.HALF_PI <= r1 && ProjMath.HALF_PI <= r2 ) {
    const minr = Math.min(r1, r2);
    return Math.sin(2 * Math.asin(minr/2));
  }
  return 1.0;
};

/**
 * \sqrt{x^2+y^2} \cot(2 \sin^{-1}(\sqrt{x^2+y^2}/2))
 */
ProjDiscreteMath.prototype.R_cotR_lower = function(idx, p) {
  const t = (0 <= idx) ? (idx+1) * this.unit_ : -idx * this.unit_;
  const r = Math.sqrt(t * t + p * p);
  if ( r < ProjMath.EPSILON )  return 1.0;
  return (r < 2.0) ? r / Math.tan(2 * Math.asin(r/2)) : -Infinity;
};

ProjDiscreteMath.prototype.R_cotR_upper = function(idx, p) {
  const t = (0 <= idx) ? idx * this.unit_ : (-idx-1) * this.unit_;
  const r = Math.sqrt(t * t + p * p);
  if ( r < ProjMath.EPSILON )  return 1.0;
  return (r < 2.0) ? r / Math.tan(2 * Math.asin(r/2)) : -Infinity;
};

/**
 * \sin(2 \sin^{-1}(\sqrt{x^2+y^2}/2)) / \sqrt{x^2+y^2}
 */
ProjDiscreteMath.prototype.sinR_divR_lower = function(idx, p) {
  const t = (0 <= idx) ? (idx+1) * this.unit_ : -idx * this.unit_;
  const r = Math.sqrt(t * t + p * p);
  if ( r < ProjMath.EPSILON )  return 1.0;
  return (r < 2.0) ? Math.sin(2 * Math.asin(r/2)) / r : 0.0;
};

ProjDiscreteMath.prototype.sinR_divR_upper = function(idx, p) {
  const t = (0 <= idx) ? idx * this.unit_ : (-idx-1) * this.unit_;
  const r = Math.sqrt(t * t + p * p);
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
function ProjLAEA(lam0, phi0, optDivN) {
  this.lam0 = lam0;
  this.phi0 = phi0;
  this.divN_ = (typeof optDivN !== 'undefined') ? optDivN : 180;
  //
  this.dMath_ = new ProjDiscreteMath(this.divN_);
  this.sin_phi0_ = Math.sin(phi0);
  this.cos_phi0_ = Math.cos(phi0);
}

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
  let lim = 2.0;
  if ( rate != null ) {
    lim *= rate;
  }
  if ( Math.abs(x) < lim && Math.abs(y) < lim ) {
    return true;
  }
  const r2 = x * x + y * y;
  return r2 < lim * lim;
};

/**
 * Forward projection.
 * @param {Float} lambda
 * @param {Float} phi
 * @return {Point}
 */
ProjLAEA.prototype.forward = function(lambda, phi) {
  const sin_phi = Math.sin(phi);
  const cos_phi = Math.cos(phi);
  const sin_lam = Math.sin(lambda - this.lam0);
  const cos_lam = Math.cos(lambda - this.lam0);

  const c = 1 + this.sin_phi0_ * sin_phi + this.cos_phi0_ * cos_phi * cos_lam;
  if ( Math.abs(c) < ProjMath.EPSILON ) {
    return null;  //  対蹠点
  }

  const k = Math.sqrt(2 / c);
  const x = k * cos_phi * sin_lam;
  const y = k * ( this.cos_phi0_ * sin_phi - this.sin_phi0_ * cos_phi * cos_lam );
  return {x: x, y: y};
};

/**
 * Inverse projection.
 * @param {Float} x
 * @param {Float} y
 * @param {GeoCoord}
 */
ProjLAEA.prototype.inverse = function(x, y) {
  const rh2 = x * x + y * y;
  if ( 4.0 < rh2 )   return null;

  const rho = Math.sqrt(rh2);
  if ( rho < ProjMath.EPSILON )  return {lambda: this.lam0, phi: this.phi0};

  const c_rh = 2 * Math.asin(ProjMath.clamp(rho/2, -1, 1));

  const sin_c = Math.sin(c_rh);
  const cos_c = Math.cos(c_rh);

  const sinPhi = cos_c * this.sin_phi0_ + y * sin_c * this.cos_phi0_ / rho;
  const phi = Math.asin(ProjMath.clamp(sinPhi, -1, 1));
  let lam;
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
  const x_min = (x1 <= x2) ? x1 : x2;
  const x_max = (x1 <= x2) ? x2 : x1;
  const y_min = (y1 <= y2) ? y1 : y2;
  const y_max = (y1 <= y2) ? y2 : y1;

  if ( x_min <= 0 && 0 <= x_max ) {
    const yn = ProjMath.SQRT_2 * this.cos_phi0_ / Math.sqrt(1 + this.sin_phi0_);
    const containsNorthPole =
        ( -(ProjMath.HALF_PI - ProjMath.EPSILON) < this.phi0 ) && (y_min <= yn) && (yn <= y_max);

    const ys = - ProjMath.SQRT_2 * this.cos_phi0_ / Math.sqrt(1 - this.sin_phi0_);
    const containsSouthPole =
        ( this.phi0 < ProjMath.HALF_PI - ProjMath.EPSILON ) && (y_min <= ys) && (ys <= y_max);

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

    //  N極から上方への半直線、あるいはS極から下方への半直線を跨ぐ場合
    if ( y_max < ys || yn < y_min ) {
      const rangeMinus1 = this.inverseLambdaRangeAtY_([x_min, -ProjMath.EPSILON], [y_min, y_max]);
      const rangeMinus2 = this.inverseLambdaRangeAtX_([y_min, y_max], [x_min]);
      const rangePlus1 = this.inverseLambdaRangeAtY_([ProjMath.EPSILON, x_max], [y_min, y_max]);
      const rangePlus2 = this.inverseLambdaRangeAtX_([y_min, y_max], [x_max]);

      const rangeMinus = this.mergeRange_(rangeMinus1, rangeMinus2);
      const rangePlus = this.mergeRange_(rangePlus1, rangePlus2);

      let lamRange1 = [rangePlus[0], rangeMinus[1] + 2 * Math.PI];
      const phiRange1 = this.inversePhiRange_([x_min, x_max], [y_min, y_max]);
      lamRange1 = this.normalizeLambdaRange_(lamRange1);
      return {lambda: lamRange1, phi: phiRange1};
    }
  }

  //  通常ケース
  const phiRange2 = this.inversePhiRange_([x_min, x_max], [y_min, y_max]);
  let lamRange2 = this.inverseLambdaRange_([x_min, x_max], [y_min, y_max]);
  lamRange2 = this.normalizeLambdaRange_(lamRange2);
  return {lambda: lamRange2, phi: phiRange2};
};


ProjLAEA.prototype.mergeRange_ = function(origRange, newRange) {
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


ProjLAEA.prototype.normalizeLambdaRange_ = function(range) {
  const lam = range[0];
  if ( -Math.PI <= lam && lam < Math.PI ) {
    return range;
  }
  const d = 2 * Math.PI * Math.floor( (lam + Math.PI) / (2 * Math.PI) );
  return [range[0] - d, range[1] - d];
};


ProjLAEA.prototype.inverseLambdaRange_ = function(xRange, yRange) {
  const x_min = (xRange[0] <= xRange[1]) ? xRange[0] : xRange[1];
  const x_max = (xRange[0] <= xRange[1]) ? xRange[1] : xRange[0];
  const y_min = (yRange[0] <= yRange[1]) ? yRange[0] : yRange[1];
  const y_max = (yRange[0] <= yRange[1]) ? yRange[1] : yRange[0];

  const rangeAtY = this.inverseLambdaRangeAtY_([x_min, x_max], [y_min, y_max]);
  const rangeAtX = this.inverseLambdaRangeAtX_([y_min, y_max], [x_min, x_max]);
  const range = this.mergeRange_(rangeAtX, rangeAtY);

  return range;
};


ProjLAEA.prototype.inverseLambdaRangeAtY_ = function(xRange, yValues) {
  const x_min = (xRange[0] <= xRange[1]) ? xRange[0] : xRange[1];
  const x_max = (xRange[0] <= xRange[1]) ? xRange[1] : xRange[0];

  let range = null;

  const x_idx_min = this.dMath_.toDiscrete(x_min);
  const x_idx_max = this.dMath_.toDiscrete(x_max);

  const numY = yValues.length;

  for ( let x_idx = x_idx_min; x_idx <= x_idx_max; ++x_idx ) {
    for ( let i = 0; i < numY; ++i ) {
      const r = this.inverseLambdaAtY_(x_idx, yValues[i]);
      range = this.mergeRange_(range, r);
    }
  }

  return range;
};


ProjLAEA.prototype.inverseLambdaRangeAtX_ = function(yRange, xValues) {
  const y_min = (yRange[0] <= yRange[1]) ? yRange[0] : yRange[1];
  const y_max = (yRange[0] <= yRange[1]) ? yRange[1] : yRange[0];

  let range = null;

  const y_idx_min = this.dMath_.toDiscrete(y_min);
  const y_idx_max = this.dMath_.toDiscrete(y_max);

  const numX = xValues.length;

  for ( let y_idx = y_idx_min; y_idx <= y_idx_max; ++y_idx ) {
    for ( let i = 0; i < numX; ++i ) {
      const r = this.inverseLambdaAtX_(y_idx, xValues[i]);
      range = this.mergeRange_(range, r);
    }
  }

  return range;
};


ProjLAEA.prototype.inversePhiRange_ = function(xRange, yRange) {
  const x_min = (xRange[0] <= xRange[1]) ? xRange[0] : xRange[1];
  const x_max = (xRange[0] <= xRange[1]) ? xRange[1] : xRange[0];
  const y_min = (yRange[0] <= yRange[1]) ? yRange[0] : yRange[1];
  const y_max = (yRange[0] <= yRange[1]) ? yRange[1] : yRange[0];

  const rangeAtY = this.inversePhiRangeAtY_([x_min, x_max], [y_min, y_max]);
  const rangeAtX = this.inversePhiRangeAtX_([y_min, y_max], [x_min, x_max]);
  const range = this.mergeRange_(rangeAtX, rangeAtY);

  return range;
};


ProjLAEA.prototype.inversePhiRangeAtY_ = function(xRange, yValues) {
  const xmin = (xRange[0] <= xRange[1]) ? xRange[0] : xRange[1];
  const xmax = (xRange[0] <= xRange[1]) ? xRange[1] : xRange[0];

  let range = null;

  const x_idx_min = this.dMath_.toDiscrete(xmin);
  const x_idx_max = this.dMath_.toDiscrete(xmax);

  const numY = yValues.length;

  for ( let x_idx = x_idx_min; x_idx <= x_idx_max; ++x_idx ) {
    for ( let i = 0; i < numY; ++i ) {
      const r = this.inversePhiAtY_(x_idx, yValues[i]);
      range = this.mergeRange_(range, r);
    }
  }

  return range;
};


ProjLAEA.prototype.inversePhiRangeAtX_ = function(yRange, xValues) {
  const ymin = (yRange[0] <= yRange[1]) ? yRange[0] : yRange[1];
  const ymax = (yRange[0] <= yRange[1]) ? yRange[1] : yRange[0];

  let range = null;

  const y_idx_min = this.dMath_.toDiscrete(ymin);
  const y_idx_max = this.dMath_.toDiscrete(ymax);

  const numX = xValues.length;

  for ( let y_idx = y_idx_min; y_idx <= y_idx_max; ++y_idx ) {
    for ( let i = 0; i < numX; ++i ) {
      const r = this.inversePhiAtX_(y_idx, xValues[i]);
      range = this.mergeRange_(range, r);
    }
  }

  return range;
};


ProjLAEA.prototype.inverseLambdaAtX_ = function(y_idx, x) {
  if ( ProjMath.HALF_PI - ProjMath.EPSILON < Math.abs(this.phi0) ) {
    const sign = (0 < this.phi0) ? -1 : +1;
    const yl = sign * this.dMath_.X_lower(y_idx);
    const yu = sign * this.dMath_.X_upper(y_idx);
    const y_max = (yl <= yu) ? yu : yl;
    const y_min = (yl <= yu) ? yl : yu;
    const range = ProjMath.atan2Range({min: x, max: x}, {min: y_min, max: y_max});
    return [range.min + this.lam0, range.max + this.lam0];
  }

  const t1l = this.cos_phi0_ * this.dMath_.R_cotR_lower(y_idx, x);
  const t1u = this.cos_phi0_ * this.dMath_.R_cotR_upper(y_idx, x);
  const t1_max = (t1l <= t1u) ? t1u : t1l;
  const t1_min = (t1l <= t1u) ? t1l : t1u;

  const t2l = - this.sin_phi0_ * this.dMath_.X_lower(y_idx);
  const t2u = - this.sin_phi0_ * this.dMath_.X_upper(y_idx);
  const t2_max = (t2l <= t2u) ? t2u : t2l;
  const t2_min = (t2l <= t2u) ? t2l : t2u;

  const t_max = t1_max + t2_max;
  const t_min = t1_min + t2_min;

  const r = ProjMath.atan2Range({min: x, max: x}, {min: t_min, max: t_max});
  return [r.min + this.lam0, r.max + this.lam0];
};


ProjLAEA.prototype.inverseLambdaAtY_ = function(x_idx, y) {
  if ( ProjMath.HALF_PI - ProjMath.EPSILON < Math.abs(this.phi0) ) {
    const sign = (0 < this.phi0) ? -1 : +1;
    const x_min = this.dMath_.X_lower(x_idx);
    const x_max = this.dMath_.X_upper(x_idx);
    const range = ProjMath.atan2Range({min: x_min, max: x_max}, {min: sign * y, max: sign * y});
    return [range.min + this.lam0, range.max + this.lam0];
  }
  const t1 = this.cos_phi0_ * this.dMath_.R_cotR_lower(x_idx, y) - this.sin_phi0_ * y;
  const t2 = this.cos_phi0_ * this.dMath_.R_cotR_upper(x_idx, y) - this.sin_phi0_ * y;
  const t_max = (t2 <= t1) ? t1 : t2;
  const t_min = (t2 <= t1) ? t2 : t1;

  const s_min = this.dMath_.X_lower(x_idx);
  const s_max = this.dMath_.X_upper(x_idx);

  const r = ProjMath.atan2Range({min: s_min, max: s_max}, {min: t_min, max: t_max});
  return [r.min + this.lam0, r.max + this.lam0];
};


ProjLAEA.prototype.inversePhiAtY_ = function(x_idx, y) {
  const t1l = this.dMath_.cosR_lower(x_idx, y) * this.sin_phi0_;
  const t1u = this.dMath_.cosR_upper(x_idx, y) * this.sin_phi0_;
  const t1_max = (t1l <= t1u) ? t1u : t1l;
  const t1_min = (t1l <= t1u) ? t1l : t1u;

  const t2l = y * this.dMath_.sinR_divR_lower(x_idx, y) * this.cos_phi0_;
  const t2u = y * this.dMath_.sinR_divR_upper(x_idx, y) * this.cos_phi0_;
  const t2_max = (t2l <= t2u) ? t2u : t2l;
  const t2_min = (t2l <= t2u) ? t2l : t2u;

  const t_max = ProjMath.clamp(t1_max + t2_max, -1, 1);
  const t_min = ProjMath.clamp(t1_min + t2_min, -1, 1);

  return [Math.asin(t_min), Math.asin(t_max)];
};


ProjLAEA.prototype.inversePhiAtX_ = function(y_idx, x) {
  const t1l = this.dMath_.cosR_lower(y_idx, x) * this.sin_phi0_;
  const t1u = this.dMath_.cosR_upper(y_idx, x) * this.sin_phi0_;
  const t1_max = (t1l <= t1u) ? t1u : t1l;
  const t1_min = (t1l <= t1u) ? t1l : t1u;

  const y1_abs = Math.abs(this.dMath_.X_lower(y_idx));
  const y2_abs = Math.abs(this.dMath_.X_upper(y_idx));
  const y_abs_max = (y1_abs <= y2_abs) ? y2_abs : y1_abs;
  const y_abs_min = (y1_abs <= y2_abs) ? y1_abs : y2_abs;

  const cos_phi0_abs = Math.abs(this.cos_phi0_);
  const t2_abs_max = y_abs_max * this.dMath_.sinR_divR_upper(y_idx, x) * cos_phi0_abs;
  const t2_abs_min = y_abs_min * this.dMath_.sinR_divR_lower(y_idx, x) * cos_phi0_abs;

  const t2_sign = (0 <= y_idx * this.cos_phi0_) ? +1 : -1;
  const t2_max = (0 < t2_sign) ? +t2_abs_max : -t2_abs_min;
  const t2_min = (0 < t2_sign) ? +t2_abs_min : -t2_abs_max;

  const t_max = ProjMath.clamp(t1_max + t2_max, -1, 1);
  const t_min = ProjMath.clamp(t1_min + t2_min, -1, 1);

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
  'uniform lowp int uCoordType;',
  'uniform lowp int uTextureType;',

  'const float pi = 3.141592653589793;',
  'const float epsilon = 0.001;',

  'vec2 proj_forward(vec2 center, vec2 lp) {',
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
  '    return 2.0 * normalize(vec2(x, y));',
  '  }',

  '  float k = sqrt(2.0 / (1.0 + v));',

  '  return k * vec2(x, y);',
  '}',

  'const float xyDomain = 0.86 * 0.707106781 * pi;',

  'float check_xy_range(vec2 xy) {',
  '  return 1.0 - step(xyDomain, length(xy));',
  '}',

  'void main() {',
  '  vInRange = 1.0;',
  '  vec3 pos;',
  '  if ( uTextureType == 2 || uCoordType == 2 ) {',
  '    pos = vec3(aCoordX, aCoordY, 1.0);',
  '  } else if ( uCoordType == 1 ) {',
  '    pos = uFwdTransform * vec3(aCoordX, aCoordY, 1.0);',
  '    vInRange = check_xy_range(vec2(aCoordX, aCoordY));',
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
ProjLAEA.FRAGMENT_SHADER_STR = [

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
  '  float xyRadius = 2.0;',
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

  'float inner_xy(vec2 xy) {',
  '  float xyRadius = 2.0;',
  '  return 1.0 - smoothstep( (1.0 - blurRatio) * xyRadius, (1.0 + blurRatio) * xyRadius, length(xy) );',
  '}',

  'float validate_xy(vec2 xy) {',
  '  float xyRadius = 2.0;',
  '  return 1.0 - step(xyRadius, length(xy));',
  '}',


  'vec2 graticule_level(vec2 lp, bool isNearDateLine) {',
  '  vec2 lonlat = degrees(lp);',
  '  if ( isNearDateLine ) {',
  '    lonlat.x = mod(lonlat.x + 360.0, 360.0);',
  '  }',
  '  return floor(lonlat / uGraticuleIntervalDeg);',
  '}',


  'bool render_graticule() {',
  '  vec2 viewCoord = (uInvTransform * vec3(vCoord.x, vCoord.y, 1.0)).xy;',
  '  if ( validate_xy(viewCoord) == 0.0 ) {',
  '    return false;',
  '  }',

  '  vec2 lp = proj_inverse(uProjCenter, viewCoord);',
  '  vec2 baseLonLat = degrees(lp);',
  '  float absLat = abs(baseLonLat.y);',
  '  if (81.0 < absLat) {',
  '    return false;',
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
  '    return false;',
  '  }',
  '  if ( validate_xy(v10) == 0.0 ||  validate_xy(v11) == 0.0 || validate_xy(v12) == 0.0 || validate_xy(v13) == 0.0) {',
  '    return false;',
  '  }',
  '  if ( validate_xy(v20) == 0.0 ||  validate_xy(v21) == 0.0 || validate_xy(v22) == 0.0 || validate_xy(v23) == 0.0) {',
  '    return false;',
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
  '    return false;',
  '  }',

  '  vec3 lineColor = vec3(0.8);',
  '  gl_FragColor = vec4(lineColor, alpha * 0.75);',

  '  return true;',
  '}',

  'void main() {',
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

  '  if ( uTextureType == 2 ) {',
  '    float inXY = 1.0;',
  '    vec2 coord;',
  '    if ( uCoordType == 2 ) {',
  '      coord = vCoord;',
  '    } else {',
  '      vec3 viewCoord = uInvTransform * vec3(vCoord.x, vCoord.y, 1.0);',
  '      inXY = inner_xy(viewCoord.xy);',
  '      if ( 0.0 < inXY ) {',
  '        if ( uCoordType == 1 ) {',
  '          coord = viewCoord.xy;',
  '        } else if ( uCoordType == 0 ) {',
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

  '  } else if ( uTextureType == 1 ) {',
  '    outColor = texture2D(uTexture, gl_PointCoord);',
  '    isDiscard = (outColor.a == 0.0);',

  '  } else {',
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
