#!/usr/bin/env python
# -*- coding: utf-8 -*-

import time
from stravalib import Client

import private_values
import waypoint
from geometry import *


def timeit(f):
    def timed(*args, **kw):
        ts = time.time()
        result = f(*args, **kw)
        te = time.time()
        print("function time {} : {} sec".format(f.__name__, te - ts))
        return result
    return timed


class TokenException( Exception ): pass


@timeit
def get_strava_segments(box, activity_type='running'):
    response = None
    try:
        client = Client(access_token=private_values.STRAVA_ACCESS_TOKEN)
        response = client.explore_segments(box.bounds, activity_type=activity_type)
    except Exception:
        err = TokenException( "Invalid Strava token. Get a valid API key from Strava \
            and replace the ACCESS_TOKEN value in 'private_values.py'" )
        raise err
    return response


def get_segments_pts(response, Pts, index_used, lat, lon, lim_dist):

    for segment in response:

        # print segment.elev_difference

        lat_start = segment.start_latlng.lat
        lon_start = segment.start_latlng.lon
        match, near_lon, near_lat, index, min_dist = find_nearest(lon, lat, lon_start, lat_start, lim_dist)

        lat_end = segment.end_latlng.lat
        lon_end = segment.end_latlng.lon
        match2, near_lon2, near_lat2, index2, min_dist = find_nearest(lon, lat, lon_end, lat_end, lim_dist)

        # print('index :' + str(index) + ' ' + str(index2))
        if match and match2 and (index < index2):
            # log.debug('Distance to node: ' + '%.2f' % (min_dist * 1e3) + ' m')
            [lon_new, lat_new, new_gpx_index] = add_new_coordinate(lon, lat, lon_start, lat_start, index)
            query_name = 'strava_start'
            name = 'Start ' + segment.name

            # Because only 1 POI is possible per GPS point
            if index not in index_used and new_gpx_index is not None:
                # log.debug(query_name + " - " + name)
                Pt = waypoint.Waypoint(name, 'strava', lon_new, lat_new, '', segment.id, index, new_gpx_index,
                                       query_name, True, min_dist, tags=segment)
                Pts.append(Pt)
                index_used.append(index)
            else:
                # log.debug('/!\ Node index already used: ' + query_name + " - " + name)
                pass

            [lon_new, lat_new, new_gpx_index] = add_new_coordinate(lon, lat, lon_end, lat_end, index2)
            query_name = 'strava_end'
            name = 'End ' + segment.name

            # Because only 1 POI is possible per GPS point
            if index2 not in index_used and new_gpx_index is not None:
                # log.debug(query_name + " - " + name)
                Pt = waypoint.Waypoint(name, 'strava', lon_new, lat_new, '', segment.id, index2, new_gpx_index,
                                       query_name, True, min_dist, tags=segment)
                Pts.append(Pt)
                index_used.append(index2)
            else:
                # log.debug('/!\ Node index already used: ' + query_name + " - " + name)
                pass

    return Pts
