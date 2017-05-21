#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Created on Mon Oct 17 15:28:58 2016

@author: christophe.anselmo@gmail.com


"""

import os
import sys
import logging as log
from threading import Thread
import gpxpy                                        # https://github.com/tkrajina/gpxpy
import gpxpy.gpx

from osm import *
from strava import *
from flickr import *

# import pdb

LOGFILE_PATH = os.path.join(os.path.dirname(__file__), 'wpts.log')

def timeit(f):
    def timed(*args, **kw):
        ts = time.time()
        result = f(*args, **kw)
        te = time.time()
        print("function time {} : {} sec".format(f.__name__, te - ts))
        return result
    return timed


class Box(object):
    def __init__(self, lon, lat):
        margin = 0.001
        self.west = min(lon) - margin
        self.east = max(lon) + margin
        self.south = min(lat) - margin
        self.north = max(lat) + margin

    @property
    def bounds(self):
        return [self.south, self.west, self.north, self.east]

    @property
    def bounds_str(self):
        return ','.join([str(x) for x in self.bounds])


class Overpass(Thread):
    def __init__(self, box, query):
        Thread.__init__(self)
        self.box = box
        self.query = query
        self.ret = None

    def run(self):
        self.response = overpass_query(self.box, self.query)
        return

    def join(self):
        Thread.join(self)
        return self.response


def parse_route(gpx, simplify=False):
    if not gpx.tracks:
        table = [(point.latitude, point.longitude, point.elevation) for track in gpx.routes
                 for point in track.points]
        lat, lon, ele = [x[0] for x in table], [x[1] for x in table], [x[2] for x in table]
    else:
        table = [(point.latitude, point.longitude, point.elevation) for track in gpx.tracks
                 for segment in track.segments for point in segment.points]
        lat, lon, ele = [x[0] for x in table], [x[1] for x in table], [x[2] for x in table]

    # if simplify is True:
    #     lat, lon, ele = uniquify(lat, lon, ele)

    # if len(lat) == 0:
    #     raise InvalidGpxFile('No track or route in gpx')

    gpx_name = track.name
    return gpx_name, lat, lon, ele


# def uniquify(lat, lon, ele):
#     precision = 6
#     approx_coord_full = list(map(lambda x, y, z: ((round(x, precision), round(y, precision)), z), lat, lon, ele))
#     in_it = set()
#     res = [elem for elem in approx_coord_full if elem[0] not in in_it and not in_it.add(elem[0])]
#     lat = [x[0][0] for x in res]
#     lon = [x[0][1] for x in res]
#     ele = [x[1] for x in res]
#     return lat, lon, ele


def build_and_save_gpx(gpx_data, gpx_name, Pts, lat, lon, ele, index_used, gpxoutputname, keep_old_wpt=True):
    gpx = gpxpy.gpx.GPX()
    # Create first track in our GPX:
    gpx_track = gpxpy.gpx.GPXTrack()
    gpx_track.name = gpx_name
    gpx_track.link = 'http://www.mountaingpx.fr'
    gpx_track.source = 'Mountain GPX'
    gpx.tracks.append(gpx_track)
    gpx_segment = gpxpy.gpx.GPXTrackSegment()
    gpx_track.segments.append(gpx_segment)

    _lat = []
    _lon = []
    _ele = []

    for i in range(len(lat)):
        if i in index_used:
            pt = filter(lambda pt: pt.index == i, Pts)
            P = pt[0]
            # Add new coord before i
            if (P.new_gpx_index < i) and P.new_gpx_index is not None:
                # gpx_segment.points.append(gpxpy.gpx.GPXTrackPoint(P.lat, P.lon, elevation=ele[i]))
                _lat.append(P.lat)
                _lon.append(P.lon)
                _ele.append(ele[i])
        # gpx_segment.points.append(gpxpy.gpx.GPXTrackPoint(lat[i], lon[i], elevation=ele[i]))
        _lat.append(lat[i])
        _lon.append(lon[i])
        _ele.append(ele[i])
        if i in index_used:
            # Add new coord after i
            if (P.new_gpx_index > i) and P.new_gpx_index is not None:
                # gpx_segment.points.append(gpxpy.gpx.GPXTrackPoint(P.lat, P.lon, elevation=ele[i]))
                _lat.append(P.lat)
                _lon.append(P.lon)
                _ele.append(ele[i])

    _lat2, _lon2, _ele2 = filtering_duplicate(_lat, _lon, _ele)
    for i in range(len(_lat2)):
        gpx_segment.points.append(gpxpy.gpx.GPXTrackPoint(_lat2[i], _lon2[i], elevation=_ele2[i]))

    if keep_old_wpt is True:
        for waypoint in gpx_data.waypoints:
            # print(waypoint)
            gpx.waypoints.append(waypoint)

    for Pt in Pts:
        gpx.waypoints.append(gpxpy.gpx.GPXWaypoint(
        Pt.lat, Pt.lon, elevation=Pt.ele, name=Pt.name,
        symbol=Pt.query_name, type=Pt.query_name, description=Pt.description))

    with open(gpxoutputname, 'w') as f:
        f.write(gpx.to_xml())


def filtering_duplicate(_lat, _lon, _ele):
    _lat2 = []
    _lon2 = []
    _ele2 = []
    for i in range(len(_lat)):

        if i > 1:
            if (_lat[i] != _lat[i-1]) and (_lon[i] != _lon[i-1]):
                _lat2.append(_lat[i])
                _lon2.append(_lon[i])
                _ele2.append(_ele[i])

    return _lat2, _lon2, _ele2


def shift(l, n):
    return l[n:] + l[:n]


def change_route(lat, lon, ele, reverse=False, index=None):
    if reverse is True:
        lat = lat[::-1]
        lon = lon[::-1]
        ele = ele[::-1]
    if index is not None:
        if index > len(lat):
            print('index number too long')
        else:
            lat = shift(lat, index)
            lon = shift(lon, index)
            ele = shift(ele, index)
    return lat, lon, ele


def osm_wpt(fpath, gpxoutputname='out.gpx', lim_dist=0.05, keep_old_wpt=True, reverse=False,
    wpt_json=None, wpt_no_name_json=None, overpass_custom_str=None, strava_segment=None):
    '''
    lim_dist in kilometers (0.05 #default)
    keep_old_wpt (False #defaut)
    '''

    log.basicConfig(filename=LOGFILE_PATH, level=log.WARNING)
    log.info('Started')

    with open(fpath, 'r') as gpx_file:
        gpx = gpxpy.parse(gpx_file)
        (gpx_name, lat, lon, ele) = parse_route(gpx)

    # Change start point manually
    lat, lon, ele = change_route(lat, lon, ele, reverse=reverse, index=None)
    box = Box(lon, lat)

    index_used = []
    Pts = []

    # Ways
    query = construct_overpass_query([], 'way', wpt_json, True)
    query = construct_overpass_query(query, 'way', wpt_no_name_json, False)
    query = add_custom_overpass_query(query, 'way', overpass_custom_str)
    thread_2 = Overpass(box, query)
    # Nodes
    query = construct_overpass_query([], 'node', wpt_json, True)
    query = construct_overpass_query(query, 'node', wpt_no_name_json, False)
    query = add_custom_overpass_query(query, 'node', overpass_custom_str)
    thread_1 = Overpass(box, query)

    thread_1.start()
    thread_2.start()

    if strava_segment in ['running', 'riding']:
        response = get_strava_segments(box, activity_type=strava_segment)
        if response is not None:
             Pts = get_segments_pts(response, Pts, index_used, lat, lon, lim_dist)

        x, y = 2, 2
        width = box.east - box.west
        height = box.north - box.south
        small_box = Box(lon, lat)
        for i in range(x):
            small_box.north = box.north - height/x * (i)
            small_box.south = box.north - height/x * (i+1)
            for j in range(y):
                small_box.east = box.east - width/y * (j)
                small_box.west = box.east - width/y * (j+1)
                response = get_strava_segments(small_box, activity_type=strava_segment)
                if response is not None:
                     Pts = get_segments_pts(response, Pts, index_used, lat, lon, lim_dist)
                     print("Number of segments: " + str(len(Pts)))


    response_1 = thread_1.join()
    if response_1 is not None:
        Pts = get_overpass_nodes(response_1, Pts, index_used, lat, lon, lim_dist)

    response_2 = thread_2.join()
    if response_2 is not None:
        Pts = get_overpass_ways(response_2, Pts, index_used, lat, lon, lim_dist)

    build_and_save_gpx(gpx, gpx_name, Pts, lat, lon, ele, index_used, gpxoutputname, keep_old_wpt)
    print('Number of gpx points in route : ' + str(len(lat)))

    wpts_number = len(index_used)
    print(str(wpts_number) + ' Waypoint(s)')
    return wpts_number


if __name__ == "__main__":
    fpath_out = 'out.gpx'
    if len(sys.argv) > 1:
        fpath = sys.argv[1]
        if len(sys.argv) > 2:
            fpath_out = sys.argv[2]
    else:
        fpath = u'test.gpx'

    print(sys.version)
    osm_wpt(fpath, gpxoutputname=fpath_out)
    # wpts(fpath, gpxoutputname=fpath_out, strava_segment="running")
