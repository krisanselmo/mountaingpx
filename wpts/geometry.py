#!/usr/bin/env python
# -*- coding: utf-8 -*-

from math import radians, cos, sin, asin, sqrt


def find_nearest(lon, lat, lon2, lat2, lim_dist):
    """
    Purpose - Find if an OSM node matches with the gpx route and return the nearest
    coordinates and its index
    """
    dist = list(map(lambda x, y: (haversine(x, y, lon2, lat2)), lon, lat))
    dist_min = min(dist)
    i = dist.index(dist_min)
    # with open("nearest_new.txt", "a") as f:
    #     f.write(str([dist_min < lim_dist, lon[i], lat[i], i, dist_min]) + '\n')
    return dist_min < lim_dist, lon[i], lat[i], i, dist_min


def find_nearest_way(lon, lat, lon2, lat2, lim_dist):
    """
    Purpose - Find if an OSM way matches with the gpx route and return the nearest
    coordinates and its index
    """
    dist2 = []
    i2 = []
    match = 0

    for j in range(len(lat2)):
        dist = []
        for i in range(len(lat)):
            d = haversine(lon[i], lat[i], lon2[j], lat2[j])
            dist.append(d)
        dist2.append(min(dist))
        i2.append(dist.index(min(dist)))

    if min(dist2) < lim_dist:
        match = 1
        i = i2[dist2.index(min(dist2))]
        # log.debug('Distance to way: ' + '%.2f' % (min(dist2)*1e3) + ' m')

    return(match, lon[i], lat[i], i)


def add_new_coordinate(lon, lat, lon2, lat2, index):
    """
    Purpose - Add a new coordinate point
    Input: coordinate of the GPX track (lon, lat, index), coordinate of the POI (lon2, lat2)
    Return new coordinates: (longitude, latitude, index) 
    """
    if (index == 0) or (index+1 == len(lat)):
        return None, None, None

    d_prev = haversine(lon[index-1], lat[index-1], lon2, lat2)
    d_next = haversine(lon[index+1], lat[index+1], lon2, lat2)

    if d_prev < d_next:
        i = index-1
    else:
        i = index+1

    # print "PERP - lat[i]: " + str(lat[i]) + " - lat2: " + str(lat2)
    [lon_new, lat_new, exist] = get_perp(lon[i], lat[i], lon[index], lat[index], lon2, lat2)
    if exist == 1:
        i = index
    precision = 6
    # print "\t - lat_new: " + str(round(lat_new, precision))
    return round(lon_new, precision), round(lat_new, precision), i


def get_perp(X1, Y1, X2, Y2, X3, Y3):
    """
    Purpose - X1, Y1, X2, Y2 = Two points representing the ends of the line
    segment
              X3,Y3 = The offset point
    'Returns - X4,Y4 = Returns the point on the line perpendicular to the
    offset or None if no such point exists
    """
    XX = X2 - X1
    YY = Y2 - Y1
    if (XX*XX) + (YY*YY) == 0:
        return X2, Y2, 1
    shortest_length = ((XX*(X3 - X1)) + (YY*(Y3 - Y1)))/((XX*XX) + (YY*YY))
    X4 = X1 + XX * shortest_length
    Y4 = Y1 + YY * shortest_length
#    if X4 < X2 and X4 > X1 and Y4 < Y2 and Y4 > Y1:
    return X4, Y4, 0
#    else:
#        return X2,Y2,1


def haversine(lon1, lat1, lon2, lat2):
    """
    Calculate the great circle distance between two points
    on the earth (specified in decimal degrees)
    From : http://stackoverflow.com/a/4913653
    """
    # convert decimal degrees to radians
    lon1, lat1, lon2, lat2 = list(map(radians, [lon1, lat1, lon2, lat2]))
    # haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat*0.5)**2 + cos(lat1) * cos(lat2) * sin(dlon*0.5)**2
    c = 2.0 * asin(sqrt(a))
    r = 6371.0 # Radius of earth in kilometers. Use 3956 for miles
    return c * r