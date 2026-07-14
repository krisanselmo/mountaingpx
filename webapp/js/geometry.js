/*
 * geometry.js — geodesic helpers (browser port of wpts/geometry.py)
 * All distances are expressed in kilometers.
 */
(function (global) {
  'use strict';

  const R = 6371.0; // Earth radius (km)
  const DEG2RAD = Math.PI / 180;

  /** Great-circle distance between two points (decimal degrees) in km. */
  function haversine(lon1, lat1, lon2, lat2) {
    const dlon = (lon2 - lon1) * DEG2RAD;
    const dlat = (lat2 - lat1) * DEG2RAD;
    const a =
      Math.sin(dlat * 0.5) ** 2 +
      Math.cos(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) * Math.sin(dlon * 0.5) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  }

  /**
   * Find the route point closest to a POI (lon2, lat2).
   * Returns { match, nearLon, nearLat, index, minDist }.
   */
  function findNearest(lon, lat, lon2, lat2, limDist) {
    let minDist = Infinity;
    let index = 0;
    for (let i = 0; i < lat.length; i++) {
      const d = haversine(lon[i], lat[i], lon2, lat2);
      if (d < minDist) {
        minDist = d;
        index = i;
      }
    }
    return { match: minDist < limDist, nearLon: lon[index], nearLat: lat[index], index, minDist };
  }

  /**
   * Find whether a way (polyline lon2/lat2) passes near the route.
   * Returns { match, nearLon, nearLat, index }.
   */
  function findNearestWay(lon, lat, lon2, lat2, limDist) {
    let bestWayDist = Infinity;
    let bestRouteIndex = 0;
    for (let j = 0; j < lat2.length; j++) {
      let localMin = Infinity;
      let localIdx = 0;
      for (let i = 0; i < lat.length; i++) {
        const d = haversine(lon[i], lat[i], lon2[j], lat2[j]);
        if (d < localMin) {
          localMin = d;
          localIdx = i;
        }
      }
      if (localMin < bestWayDist) {
        bestWayDist = localMin;
        bestRouteIndex = localIdx;
      }
    }
    return {
      match: bestWayDist < limDist,
      nearLon: lon[bestRouteIndex],
      nearLat: lat[bestRouteIndex],
      index: bestRouteIndex,
      minDist: bestWayDist,
    };
  }

  /**
   * Project the POI onto the closest track segment so the track visually
   * passes through the waypoint. Returns [lonNew, latNew, newIndex] or nulls.
   */
  function addNewCoordinate(lon, lat, lon2, lat2, index) {
    if (index === 0 || index + 1 === lat.length) {
      return [null, null, null];
    }
    const dPrev = haversine(lon[index - 1], lat[index - 1], lon2, lat2);
    const dNext = haversine(lon[index + 1], lat[index + 1], lon2, lat2);
    const i = dPrev < dNext ? index - 1 : index + 1;

    const [lonNew, latNew, exist] = getPerp(lon[i], lat[i], lon[index], lat[index], lon2, lat2);
    const newIndex = exist === 1 ? index : i;
    const p = 1e6;
    return [Math.round(lonNew * p) / p, Math.round(latNew * p) / p, newIndex];
  }

  /** Foot of the perpendicular from (X3,Y3) onto segment (X1,Y1)-(X2,Y2). */
  function getPerp(X1, Y1, X2, Y2, X3, Y3) {
    const XX = X2 - X1;
    const YY = Y2 - Y1;
    if (XX * XX + YY * YY === 0) {
      return [X2, Y2, 1];
    }
    const t = (XX * (X3 - X1) + YY * (Y3 - Y1)) / (XX * XX + YY * YY);
    return [X1 + XX * t, Y1 + YY * t, 0];
  }

  global.Geometry = { haversine, findNearest, findNearestWay, addNewCoordinate, getPerp };
})(window);
