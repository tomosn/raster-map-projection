/**
 * Raster Map Projection v0.0.29  2019-06-02
 * Copyright (C) 2016-2019 T.Seno
 * All rights reserved.
 * @license GPL v3 License (http://www.gnu.org/licenses/gpl.html)
 */
'use strict';

if (typeof module!='undefined' && module.exports) {
  var RasterProjCommon = require('./rasterproj-common.js');
  var RasterMapProjection = RasterProjCommon.RasterMapProjection;
  var ProjMath = RasterProjCommon.ProjMath;
}

// -----------------------------------------------------

RasterMapProjection.createProjection = function(lam0, phi0, optDivN) {
  return new ProjAEQD(lam0, phi0, optDivN);
};

// -----------------------------------------------------

/**
 * 区間[-pi,pi]を等分割して量子化した数学関数
 * @param {Number} divN 区間[-pi,pi]の分割数
 * @constructor
 */
function ProjDiscreteMath(divN) {
  this.divN_ = divN;
  this.unit_ = Math.PI / divN;
}

/**
 * @param {Float} t
 * @return {Int} idx
 */
ProjDiscreteMath.prototype.toDiscrete = function(t) {
  const idx = Math.floor(t / this.unit_);
  return idx;
};

/**
 * \cos\sqrt{x^2+y^2}
 * @param {Int} idx
 * @param {Float} p
 * @return {Float}
 */
ProjDiscreteMath.prototype.cosR_lower = function(idx, p) {
  const t = (0 <= idx) ? (idx+1) * this.unit_ : -idx * this.unit_;
  const r = Math.sqrt(t * t + p * p);
  return (r <= Math.PI) ?  Math.cos(r) : -1.0;
};

/**
 * @param {Int} idx
 * @param {Float} p
 * @return {Float}
 */
ProjDiscreteMath.prototype.cosR_upper = function(idx, p) {
  const t = (0 <= idx) ? idx * this.unit_ : (-idx-1) * this.unit_;
  const r = Math.sqrt(t * t + p * p);
  return (r <= Math.PI) ?  Math.cos(r) : -1.0;
};

/*
 * \sin\sqrt{x^2+y^2}
 * @param {Int} idx
 * @param {Float} p
 * @return {Float}
 */
ProjDiscreteMath.prototype.sinR_lower = function(idx, p) {
  const x1 = idx * this.unit_;
  const x2 = (idx+1) * this.unit_;
  const r1 = Math.sqrt(x1 * x1 + p * p);
  const r2 = Math.sqrt(x2 * x2 + p * p);
  if ( Math.PI <= r1 || Math.PI <= r2 ) return 0.0;
  if ( r1 <= ProjMath.HALF_PI && r2 <= ProjMath.HALF_PI ) {
    const minr = Math.min(r1, r2);
    return Math.sin(minr);
  }
  if ( ProjMath.HALF_PI <= r1 && ProjMath.HALF_PI <= r2 ) {
    const maxr = Math.max(r1, r2);
    return Math.sin(maxr);
  }
  const v1 = Math.sin(r1);
  const v2 = Math.sin(r2);
  return (v1 < v2) ? v1 : v2;
};

/*
 * \sin\sqrt{x^2+y^2}
 * @param {Int} idx
 * @param {Float} p
 * @return {Float}
 */
ProjDiscreteMath.prototype.sinR_upper = function(idx, p) {
  const x1 = idx * this.unit_;
  const x2 = (idx+1) * this.unit_;
  const r1 = Math.sqrt(x1 * x1 + p * p);
  const r2 = Math.sqrt(x2 * x2 + p * p);
  if ( Math.PI <= r1 && Math.PI <= r2 ) return 0.0;
  if ( r1 <= ProjMath.HALF_PI && r2 <= ProjMath.HALF_PI ) {
    const maxr = Math.max(r1, r2);
    return Math.sin(maxr);
  }
  if ( ProjMath.HALF_PI <= r1 && ProjMath.HALF_PI <= r2 ) {
    const minr = Math.min(r1, r2);
    return Math.sin(minr);
  }
  return 1.0;
};

/**
 * \sqrt{x^2+y^2} \cot\sqrt{x^2+y^2}
 * @param {Int} idx
 * @param {Float} p
 * @return {Float}
 */
ProjDiscreteMath.prototype.R_cotR_lower = function(idx, p) {
  const t = (0 <= idx) ? (idx+1) * this.unit_ : -idx * this.unit_;
  const r = Math.sqrt(t * t + p * p);
  if ( r < ProjMath.EPSILON )  return 1.0;
  return (r < Math.PI) ? r / Math.tan(r) : -Infinity;
};

/**
 * \sqrt{x^2+y^2} \cot\sqrt{x^2+y^2}
 * @param {Int} idx
 * @param {Float} p
 * @return {Float}
 */
ProjDiscreteMath.prototype.R_cotR_upper = function(idx, p) {
  const t = (0 <= idx) ? idx * this.unit_ : (-idx-1) * this.unit_;
  const r = Math.sqrt(t * t + p * p);
  if ( r < ProjMath.EPSILON )  return 1.0;
  return (r < Math.PI) ? r / Math.tan(r) : -Infinity;
};

/**
 * \sin\sqrt{x^2+y^2} / \sqrt{x^2+y^2}
 * @param {Int} idx
 * @param {Float} p
 * @return {Float}
 */
ProjDiscreteMath.prototype.sinR_divR_lower = function(idx, p) {
  const t = (0 <= idx) ? (idx+1) * this.unit_ : -idx * this.unit_;
  const r = Math.sqrt(t * t + p * p);
  if ( r < ProjMath.EPSILON )  return 1.0;
  return (r < Math.PI) ? Math.sin(r) / r : 0.0;
};

/**
 * \sin\sqrt{x^2+y^2} / \sqrt{x^2+y^2}
 * @param {Int} idx
 * @param {Float} p
 * @return {Float}
 */
ProjDiscreteMath.prototype.sinR_divR_upper = function(idx, p) {
  const t = (0 <= idx) ? idx * this.unit_ : (-idx-1) * this.unit_;
  const r = Math.sqrt(t * t + p * p);
  if ( r < ProjMath.EPSILON )  return 1.0;
  return (r < Math.PI) ? Math.sin(r) / r : 0.0;
};

/**
 * @param {Int} idx
 * @return {Float}
 */
ProjDiscreteMath.prototype.X_lower = function(idx) {
  return idx * this.unit_;
};

/**
 * @param {Int} idx
 * @return {Float}
 */
ProjDiscreteMath.prototype.X_upper = function(idx) {
  return (idx+1) * this.unit_;
};


/* ------------------------------------------------------------ */

/**
 * Spherical Azimuthal Equidistant Projection
 * @param {Number} lam0  latitude of the center [rad].
 * @param {Number} phi0  longitude of the center [rad].
 * @param {Object} option (divN)
 * @constructor
 */
function ProjAEQD(lam0, phi0, optDivN) {
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
ProjAEQD.RANGE_RECTANGLE = { x1:-Math.PI, y1:-Math.PI, x2:+Math.PI, y2:+Math.PI };

/**
 * @return {Object}
 */
ProjAEQD.prototype.getRange = function() {
  return Object.assign({}, ProjAEQD.RANGE_RECTANGLE);
};

/**
 * @return {GeoCoord}
 */
ProjAEQD.prototype.getProjCenter = function() {
  return {lambda: this.lam0, phi: this.phi0};
};

/**
 * @param {Float} lam
 * @param {Float} phi
 */
ProjAEQD.prototype.setProjCenter = function(lam, phi) {
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
ProjAEQD.prototype.checkXYDomain = function(x, y, rate) {
  let lim = Math.PI;
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
ProjAEQD.prototype.forward = function(lambda, phi) {
  const sin_phi = Math.sin(phi);
  const cos_phi = Math.cos(phi);
  const sin_lam = Math.sin(lambda - this.lam0);
  const cos_lam = Math.cos(lambda - this.lam0);

  const c = Math.acos( this.sin_phi0_ * sin_phi + this.cos_phi0_ * cos_phi * cos_lam );
  if ( Math.abs(c) < ProjMath.EPSILON ) {
    return {x: 0.0, y: 0.0};
  }

  const sin_c = Math.sin(c);
  if ( Math.abs(sin_c) < ProjMath.EPSILON ) {
    return null;  //  対蹠点
  }

  const k = c / sin_c;
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
ProjAEQD.prototype.inverse = function(x, y) {
  const rh2 = x * x + y * y;
  if ( ProjMath.PI_SQ < rh2 )   return null;

  const rho = Math.sqrt(rh2);
  if ( rho < ProjMath.EPSILON )  return {lambda: this.lam0, phi: this.phi0};

  const c_rh = rho;

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

/**
 * inverse bounding box
 * @param {Rectangle} rect
 * @return {GeoRect}
 */
ProjAEQD.prototype.inverseBoundingBox = function(rect) {
  const x_min = (rect.x1 <= rect.x2) ? rect.x1 : rect.x2;
  const x_max = (rect.x1 <= rect.x2) ? rect.x2 : rect.x1;
  const y_min = (rect.y1 <= rect.y2) ? rect.y1 : rect.y2;
  const y_max = (rect.y1 <= rect.y2) ? rect.y2 : rect.y1;

  if ( x_min <= 0 && 0 <= x_max ) {
    const yn = ProjMath.HALF_PI - this.phi0;
    const containsNorthPole =
        ( -(ProjMath.HALF_PI - ProjMath.EPSILON) < this.phi0 ) && (y_min <= yn) && (yn <= y_max);

    const ys = - ProjMath.HALF_PI - this.phi0;
    const containsSouthPole =
        ( this.phi0 < ProjMath.HALF_PI - ProjMath.EPSILON ) && (y_min <= ys) && (ys <= y_max);

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
      return { lambda1:lamRange1[0], lambda2:lamRange1[1], phi1:phiRange1[0], phi2:phiRange1[1] };
    }
  }

  //  通常ケース
  const phiRange2 = this.inversePhiRange_([x_min, x_max], [y_min, y_max]);
  let lamRange2 = this.inverseLambdaRange_([x_min, x_max], [y_min, y_max]);
  lamRange2 = this.normalizeLambdaRange_(lamRange2);
  return { lambda1: lamRange2[0], lambda2: lamRange2[1], phi1: phiRange2[0], phi2: phiRange2[1] };
};

/**
 * @param {Array} origRange
 * @param {Array} newRange
 * @return {Array}
 */
ProjAEQD.prototype.mergeRange_ = function(origRange, newRange) {
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

/**
 * @param {Array} range
 * @return {Array}
 */
ProjAEQD.prototype.normalizeLambdaRange_ = function(range) {
  const lam = range[0];
  if ( -Math.PI <= lam && lam < Math.PI ) {
    return range;
  }
  const d = 2 * Math.PI * Math.floor( (lam + Math.PI) / (2 * Math.PI) );
  return [range[0] - d, range[1] - d];
};

/**
 * @param {Array} xRange
 * @param {Array} yRange
 * @return {Array}
 */
ProjAEQD.prototype.inverseLambdaRange_ = function(xRange, yRange) {
  const x_min = (xRange[0] <= xRange[1]) ? xRange[0] : xRange[1];
  const x_max = (xRange[0] <= xRange[1]) ? xRange[1] : xRange[0];
  const y_min = (yRange[0] <= yRange[1]) ? yRange[0] : yRange[1];
  const y_max = (yRange[0] <= yRange[1]) ? yRange[1] : yRange[0];

  const rangeAtY = this.inverseLambdaRangeAtY_([x_min, x_max], [y_min, y_max]);
  const rangeAtX = this.inverseLambdaRangeAtX_([y_min, y_max], [x_min, x_max]);
  const range = this.mergeRange_(rangeAtX, rangeAtY);

  return range;
};

/**
 * @param {Array} xRange
 * @param {Array} yValues
 * @return {Array}
 */
ProjAEQD.prototype.inverseLambdaRangeAtY_ = function(xRange, yValues) {
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

/**
 * @param {Array} yRange
 * @param {Array} xValues
 * @return {Array}
 */
ProjAEQD.prototype.inverseLambdaRangeAtX_ = function(yRange, xValues) {
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

/**
 * @param {Array} xRange
 * @param {Array} yRange
 * @return {Array}
 */
ProjAEQD.prototype.inversePhiRange_ = function(xRange, yRange) {
  const x_min = (xRange[0] <= xRange[1]) ? xRange[0] : xRange[1];
  const x_max = (xRange[0] <= xRange[1]) ? xRange[1] : xRange[0];
  const y_min = (yRange[0] <= yRange[1]) ? yRange[0] : yRange[1];
  const y_max = (yRange[0] <= yRange[1]) ? yRange[1] : yRange[0];

  const rangeAtY = this.inversePhiRangeAtY_([x_min, x_max], [y_min, y_max]);
  const rangeAtX = this.inversePhiRangeAtX_([y_min, y_max], [x_min, x_max]);
  const range = this.mergeRange_(rangeAtX, rangeAtY);

  return range;
};

/**
 * @param {Array} xRange
 * @param {Array} yValues
 * @return {Array}
 */
ProjAEQD.prototype.inversePhiRangeAtY_ = function(xRange, yValues) {
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

/**
 * @param {Array} yRange
 * @param {Array} xValues
 * @return {Array}
 */
ProjAEQD.prototype.inversePhiRangeAtX_ = function(yRange, xValues) {
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

/**
 * @param {Int} y_idx
 * @param {Float} x
 * @return {Array}
 */
ProjAEQD.prototype.inverseLambdaAtX_ = function(y_idx, x) {
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

/**
 * @param {Int} x_idx
 * @param {Float} y
 * @return {Array}
 */
ProjAEQD.prototype.inverseLambdaAtY_ = function(x_idx, y) {
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

/**
 * @param {Int} x_idx
 * @param {Float} y
 * @return {Array}
 */
ProjAEQD.prototype.inversePhiAtY_ = function(x_idx, y) {
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

/**
 * @param {Int} y_idx
 * @param {Float} x
 * @return {Array}
 */
ProjAEQD.prototype.inversePhiAtX_ = function(y_idx, x) {
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
ProjAEQD.prototype.getVertexShaderStr = function() {
  return ProjAEQD.VERTEX_SHADER_STR;
};

/**
 * @return String
 */
ProjAEQD.prototype.getFragmentShaderStr = function() {
  return ProjAEQD.FRAGMENT_SHADER_STR;
};

/**
 *
 */
ProjAEQD.VERTEX_SHADER_STR = [

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

  '  float k;',
  '  if ( v < -1.0 + epsilon ) {',
  '    return pi * normalize(vec2(x, y));',
  '  }',

  '  float c = acos(v);',
  '  if ( abs(c) < epsilon ) {',
  '    k = 1.0;',
  '  } else {',
  '    k = c / sin(c);',
  '  }',

  '  return k * vec2(x, y);',
  '}',

  'const float xyDomain = 0.94 * pi;',

  'float check_xy_range(vec2 xy) {',
  '  return 1.0 - step(xyDomain, length(xy));',
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
ProjAEQD.FRAGMENT_SHADER_STR = [

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
  '  float xyRadius = pi;',
  '  float sinPhi0 = sin(center.y);',
  '  float cosPhi0 = cos(center.y);',

  '  float rho = length(xy);',

  '  if ( rho < epsilon ) {',
  '    return center;',
  '  }',
  '  if ( rho - epsilon > xyRadius ) {',
  '    rho = xyRadius;',
  '  }',

  '  float c_rh = rho;',

  '  float cos_c = cos(c_rh);',
  '  float sin_c = sin(c_rh);',

  '  float phi = asin( clamp( cos_c * sinPhi0 + xy.y * sin_c * cosPhi0 / rho, -1.0, 1.0 ) );',
  '  float lam = mod( center.x + atan( xy.x * sin_c, rho * cosPhi0 * cos_c - xy.y * sinPhi0 * sin_c ) + pi, 2.0 * pi ) - pi;',

  '  return vec2(lam, phi);',
  '}',

  'float inner_xy(vec2 xy) {',
  '  float xyRadius = pi;',
  '  return 1.0 - smoothstep( (1.0 - blurRatio) * xyRadius, (1.0 + blurRatio) * xyRadius, length(xy) );',
  '}',

  'float validate_xy(vec2 xy) {',
  '  float xyRadius = pi;',
  '  return 1.0 - step(xyRadius, length(xy));',
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
  module.exports = {
    RasterMapProjection: RasterMapProjection,
    ProjAEQD: ProjAEQD,
    ProjDiscreteMath: ProjDiscreteMath
  };
}
