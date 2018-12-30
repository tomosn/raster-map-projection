/**
 * Raster Map Projection v0.0.25  2018-12-30
 * Copyright (C) 2016-2018 T.Seno
 * All rights reserved.
 * @license GPL v3 License (http://www.gnu.org/licenses/gpl.html)
 */
'use strict';


/**
 * GraticuleInterpolator
 * @param proj
 * @param initDivNum
 * @param threshold
 * @param maxRecursion
 * @constructor
 */
function GraticuleInterpolator(proj, initDivNum, threshold, maxRecursion) {
  this.proj_ = proj;
  this.initDivNum_ = initDivNum;
  this.threshold_ = threshold;
  this.thSq_ = threshold * threshold;
  this.maxRecursion_ = maxRecursion;
  //
  this.longitudeProcessor_ = function(c, v) {
    const xy = this.proj_.forward(v, c);
    return this.checkRange_(xy) ? xy : null;
  }.bind(this);
  this.latitudeProcessor_ = function(c, v) {
    const xy = this.proj_.forward(c, v);
    return this.checkRange_(xy) ? xy : null;
  }.bind(this);
}

/**
 * @param xy
 */
GraticuleInterpolator.prototype.checkRange_ = function(xy) {
  if ( xy == null ) {
    return false;
  }
  return this.proj_.checkXYDomain(xy.x, xy.y, 0.9);
};

/**
 * @param phi
 * @param lam1
 * @param lam2
 */
GraticuleInterpolator.prototype.createLongitudeLine = function(phi, lam1, lam2) {
  return this.createGraticuleLine_(phi, lam1, lam2, this.longitudeProcessor_);
};

/**
 * @param lam
 * @param phi1
 * @param phi2
 */
GraticuleInterpolator.prototype.createLatitudeLine = function(lam, phi1, phi2) {
  return this.createGraticuleLine_(lam, phi1, phi2, this.latitudeProcessor_);
};

/**
 * @param v1
 * @param v2
 * @param k
 */
GraticuleInterpolator.prototype.interpolateValue_ = function(v1, v2, k) {
  return (v1 * (this.initDivNum_ - k) + v2 * k) / this.initDivNum_;
};

/**
 * @param c0
 * @param vStart
 * @param vEnd
 * @param procForward
 */
GraticuleInterpolator.prototype.searchEndPoint_ = function(c0, vStart, vEnd, procForward) {
  let prevValue = null;
  for (let idx = 0; idx < this.initDivNum_; ++idx ) {
    const v = this.interpolateValue_(vStart, vEnd, idx);
    let xy = procForward(c0, v);
    if ( xy == null ) {
      prevValue = v;
      continue;
    }
    if ( prevValue == null ) {
      return v;
    }
    //
    for (let k = 0; k < this.initDivNum_; ++k ) {
      const v0 = this.interpolateValue_(prevValue, v, k);
      xy = procForward(c0, v0);
      if ( xy != null ) {
        return v0;
      }
    }
    return v;
  }
  return null;
};

/**
 * @param c0
 * @param v1
 * @param v2
 * @param procForward
 */
GraticuleInterpolator.prototype.createGraticuleLine_ = function(c0, v1, v2, procForward) {
  const points = [];

  const vIni = this.searchEndPoint_(c0, v1, v2, procForward);
  if ( vIni == null ) {
    return null;
  }
  const vFin = this.searchEndPoint_(c0, v2, v1, procForward);
  if ( vFin == null ) {
    return null;
  }

  let length = 0.0;
  let v0 = null;
  let xy0 = null;
  for ( let k = 0; k <= this.initDivNum_; ++k ) {
    const v = this.interpolateValue_(vIni, vFin, k);
    const xy = procForward(c0, v);
    if ( xy == null ) {
      continue;
    }
    let drSq = 0.0;
    if ( xy0 != null ) {
      drSq = (xy.x - xy0.x) * (xy.x - xy0.x) + (xy.y - xy0.y) * (xy.y - xy0.y);
    }
    if ( this.thSq_ < drSq ) {
      //assert( lam0 != null );
      length += this.interpolateGraticule_(c0, v0, v, xy0, xy, 0, points, procForward);
    } else {
      const dr = Math.sqrt(drSq);
      points.push([xy, v, dr]);
      length += dr;
    }
    xy0 = xy;
    v0 = v;
  }
  return new GraticuleLine_(c0, length, points);
};

/**
 * @param c0
 * @param v1
 * @param v2
 * @param p1
 * @param p2
 * @param recurseCount
 * @param points
 * @param procForward
 */
GraticuleInterpolator.prototype.interpolateGraticule_ = function(c0, v1, v2, p1, p2, recurseCount, points, procForward) {
  let vMid = (v1 + v2) / 2.0;
  let mid = procForward(c0, vMid);
  if ( mid == null ) {
    vMid = (v1 * 2.0 + v2) / 3.0;     //  中点の代わりに1:2の点を使用
    mid = procForward(c0, vMid);
  }
  if ( mid == null ) {
    vMid = (v1 + v2 * 2.0) / 3.0;     //  中点の代わりに2:1の点を使用
    mid = procForward(c0, vMid);
  }
  if ( mid == null ) {
    console.log('MidPoint is null!!');
    const drSq = (p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y);
    const dr = Math.sqrt(drSq);
    points.push([p2, v2, dr]);
    return dr;
  }
  const drSq1 = (p1.x - mid.x) * (p1.x - mid.x) + (p1.y - mid.y) * (p1.y - mid.y);
  const drSq2 = (p2.x - mid.x) * (p2.x - mid.x) + (p2.y - mid.y) * (p2.y - mid.y);
  if ( this.maxRecursion_ <= recurseCount ) {
    //console.log('max recursion!!');
    const dr1 = Math.sqrt(drSq1);
    const dr2 = Math.sqrt(drSq2);
    points.push([mid, vMid, dr1]);
    points.push([p2, v2, dr2]);
    return dr1 + dr2;
  }
  let ret = 0.0;
  if ( drSq1 <= this.thSq_ ) {
    const dr1a = Math.sqrt(drSq1);
    points.push([mid, vMid, dr1a]);
    ret += dr1a;
  } else {
    ret += this.interpolateGraticule_(c0, v1, vMid, p1, mid, recurseCount + 1, points, procForward);
  }
  if ( drSq2 <= this.thSq_ ) {
    const dr2a = Math.sqrt(drSq2);
    points.push([p2, v2, dr2a]);
    ret += dr2a;
  } else {
    ret += this.interpolateGraticule_(c0, vMid, v2, mid, p2, recurseCount + 1, points, procForward);
  }
  return ret;
};

/* ------------------------------------------------------------ */

/**
 * GraticuleLine_
 * @param c0
 * @param length
 * @param points
 * @constructor
 */
function GraticuleLine_(c0, length, points) {
  this.c0 = c0;
  this.length_ = length;
  this.points_ = points;
}

/**
 * @param iniIndex
 * @param finIndex
 * @param unitNum
 */
GraticuleLine_.prototype.generateVariables_ = function(iniIndex, finIndex, unitNum) {
  const v1 = this.points_[iniIndex][1];
  const v2 = this.points_[finIndex][1];
  const ary = new Array(unitNum);
  for (let idx = 0; idx <= unitNum-1; idx++ ) {
    ary[idx] = (v1 * (unitNum - 1 - idx) + v2 * idx) / (unitNum - 1);
  }
  return ary;
};

/**
 * @param unitLength
 * @param separateThreshold
 * @param unitNum
 */
GraticuleLine_.prototype.generateLists = function(unitLength, separateThreshold, unitNum) {
  const buffer = [];
  let idx1 = 0;
  let length = 0.0;
  for ( let idx2 = 1; idx2 < this.points_.length; idx2++ ) {
    const rec = this.points_[idx2];
    if ( separateThreshold < rec[2] ) {
      if ( idx1 + 1 < idx2 ) {
        this.generateEachLists_(idx1, idx2-1, length, unitLength, unitNum, buffer);
      }
      idx1 = idx2;
      length = 0.0;
    } else {
      length += rec[2];
      if ( this.points_.length - 1 <= idx2 && idx1 < idx2 ) {
        this.generateEachLists_(idx1, idx2, length, unitLength, unitNum, buffer);
      }
    }
  }
  return buffer;
};

/**
 * @param start
 * @param endlength
 * @param length
 * @param nitLength
 * @param unitNum
 * @param buffer
 */
GraticuleLine_.prototype.generateEachLists_ = function(start, end, length, unitLength, unitNum, buffer) {
  //console.log("INDEX : " + start + " - " + end);
  const num = (length < unitLength) ? 1 : Math.round(length / unitLength);
  //var pointNum = end - start + 1;
  let reminderLength = length;
  let count = num;
  let iniIndex = start;
  while ( 0 < count ) {
    let dr = 0.0;
    let finIndex;
    if ( count <= 1 ) {
      //finIndex = pointNum - 1;
      finIndex = end;
    } else {
      const len = reminderLength / count;
      for ( finIndex = iniIndex + 1; finIndex <= end; finIndex++ ) {
        dr += this.points_[finIndex][2];
        if ( len <= dr || end <= finIndex ) {
          break;
        }
      }
    }
    buffer.push(this.generateVariables_(iniIndex, finIndex, unitNum));
    iniIndex = finIndex;
    count--;
    reminderLength -= dr;
    if ( end <= iniIndex ) {
      break;
    }
  }
};

/* ------------------------------------------------------------ */

/**
 * GraticuleRenderer
 * @param shaderProg
 * @param proj
 * @constructor
 */
function GraticuleRenderer(shaderProg, proj) {
  this.shaderProg_ = shaderProg;
  //
  this.proj_ = proj;   //   import from raster-map-projection
  //
  this.unitLength_ = Math.PI / 8;
  this.separateThreshold_ = Math.PI / 8;
  this.interpolator_ = new GraticuleInterpolator(this.proj_, 8, Math.PI/8, 8);
}

/**
 * @param viewWindow
 * @param dataRect
 * @param spanDeg
 */
GraticuleRenderer.prototype.renderLines = function(viewWindow, dataRect, spanDeg) {
  this.renderLatitudeLines(viewWindow, dataRect, spanDeg);
  this.renderLongitudeLines(viewWindow, dataRect, spanDeg);
};

/**
 * @param viewWindow
 * @param dataRect
 * @param spanDeg
 */
GraticuleRenderer.prototype.renderLatitudeLines = function(viewWindow, dataRect, spanDeg) {
  const phiMin = Math.max(-80.0 * Math.PI/180.0, dataRect.phi[0]);
  const phiMax = Math.min(80.0 * Math.PI/180.0, dataRect.phi[1]);
  const phiRanges = [];
  let bins;
  if ( phiMin < 0.0 && 0.0 < phiMax ) {
    bins = [phiMin, 0.0, phiMax];
  } else {
    bins = [phiMin, phiMax];
  }
  if ( phiMin < -this.proj_.phi0 && -this.proj_.phi0 < phiMax && this.proj_.phi0 !== 0.0 ) {
    for (let idx = 1; idx <= bins.length; idx++ ) {
      if ( -this.proj_.phi0 < bins[idx] ) {
        bins.splice(idx, 0, -this.proj_.phi0);
        break;
      }
    }
  }
  for (let j = 1; j < bins.length; j++ ) {
    phiRanges.push([bins[j-1], bins[j]]);
  }
  //for (var idx = 0; idx < phiRanges.length; idx++ ) {
  //  console.log(phiRanges[idx]);
  //}
  const lon1 = spanDeg * Math.floor(dataRect.lambda[0] * 180.0 / Math.PI / spanDeg);
  const lonMax = dataRect.lambda[1] * 180.0/Math.PI;
  //
  const count = this.shaderProg_.coordsBuffer_.maxNum * this.shaderProg_.coordsBuffer_.dimension;
  this.shaderProg_.prepareRenderLatitudeLine();
  for (let lon = lon1; lon <= lonMax; lon += spanDeg) {
    const lam = lon * Math.PI / 180.0;
    for (let k = 0; k < phiRanges.length; k++ ) {
      const phiRange = phiRanges[k];
      const line = this.interpolator_.createLatitudeLine(lam, phiRange[0], phiRange[1]);
      if ( line == null ) {
        continue;
      }
      const list = line.generateLists(this.unitLength_, this.separateThreshold_, count);
      for (let i = 0; i < list.length; i++ ) {
        this.shaderProg_.renderLatitudeLine(lam, list[i], viewWindow);
      }
    }
  }
};

/**
 * @param viewWindow
 * @param dataRect
 * @param spanDeg
 */
GraticuleRenderer.prototype.renderLongitudeLines = function(viewWindow, dataRect, spanDeg) {
  const lamAntipode = ProjMath.normalizeLambda(this.proj_.lam0 - Math.PI);
  const lamRanges = [];
  if ( dataRect.lambda[0] < lamAntipode && lamAntipode < dataRect.lambda[1] ) {
    lamRanges.push([dataRect.lambda[0], lamAntipode]);
    lamRanges.push([lamAntipode, dataRect.lambda[1]]);
  } else if ( lamAntipode < dataRect.lambda[1] - 2*Math.PI ) {
    lamRanges.push([lamAntipode, dataRect.lambda[1] - 2*Math.PI]);
    lamRanges.push([dataRect.lambda[0], lamAntipode + 2*Math.PI]);
  } else {
    lamRanges.push(dataRect.lambda);
  }
  //
  const lat1 = spanDeg * Math.floor(dataRect.phi[0] * 180.0 / Math.PI / spanDeg);
  const latMax = Math.min(80.0, dataRect.phi[1] * 180.0 / Math.PI);
  //
  const count = this.shaderProg_.coordsBuffer_.maxNum * this.shaderProg_.coordsBuffer_.dimension;
  this.shaderProg_.prepareRenderLongitudeLine();
  for (let lat = lat1; lat <= latMax; lat += spanDeg) {
    const phi = lat * Math.PI / 180.0;
    for (let k = 0; k < lamRanges.length; k++ ) {
      const lamRange = lamRanges[k];
      const line = this.interpolator_.createLongitudeLine(phi, lamRange[0], lamRange[1]);
      if ( line == null ) {
        continue;
      }
      const list = line.generateLists(this.unitLength_, this.separateThreshold_, count);
      for (let i = 0; i < list.length; i++ ) {
        this.shaderProg_.renderLongitudeLine(phi, list[i], viewWindow);
      }
    }
  }
};


/* ------------------------------------------------------------ */
if (typeof module != 'undefined' && module.exports) {
  module.exports = GraticuleInterpolator;
}
