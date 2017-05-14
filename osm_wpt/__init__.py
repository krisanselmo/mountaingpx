# -*- coding: utf-8 -*-
"""
Created on Mon Oct 17 15:28:58 2016

@author: christophe.anselmo@gmail.com


"""

import os
import sys
import re
import time
import logging as log
import json
import urllib
from threading import Thread
from math import radians, cos, sin, asin, sqrt
import gpxpy      # https://github.com/tkrajina/gpxpy
import overpass   # https://github.com/mvexel/overpass-api-python-wrapper
from stravalib import Client
import private_values
# import pdb

LOGFILE = os.path.join(os.path.dirname(__file__), 'osm_wpt.log')

def timeit(f):
    def timed(*args, **kw):
        ts = time.time()
        result = f(*args, **kw)
        te = time.time()
        print("function time {} : {} sec".format(f.__name__, te - ts))
        return result
    return timed


class Point(object):
    def __init__(self, name, osmtype, lon, lat, ele, osm_id, index, new_gpx_index, query_name, has_name, min_dist, tags=None):
        self.name = name
        self.osmtype = osmtype
        self.lat = lat
        self.lon = lon
        self.query_name = query_name

        if osmtype in ['node','way']:
            self.url = 'http://www.openstreetmap.org/' + osmtype + '/' + str(osm_id)
            html_content = self.construct_osm_table(tags)
        elif osmtype is 'strava':
            self.url = 'https://www.strava.com/segments/' + str(osm_id)
            html_content = self.construct_strava_table(tags)
        else:
            self.url = ''
            html_content = ''

        self.description = html_content + '<a href="' + self.url + '" target="_blank">' + str(osm_id) + '</a>'
        self.index = index
        self.new_gpx_index = new_gpx_index
        self.has_name = has_name
        self.min_dist = min_dist
        try:
            self.ele = float(ele)
        except ValueError:
            self.ele = 0


    def construct_osm_table(self, tags):
        html_content = ''
        uselesstags = ['source', 'name']
        if tags is not None:
            html_content = '<hr><table>'
            for key, value in tags.items():
                if key not in uselesstags:
                    if key == 'website':
                        value = '<a href="' + value + '" target="_blank">' + value + '</a>'
                    if key == 'wikidata':
                        value = '<a href="https://www.wikidata.org/wiki/' + value + '" target="_blank">' + value + '</a>'
                    if key == 'wikipedia':
                        try:
                            [lang, name] = value.split(':')
                            value = '<a href="https://' + lang + '.wikipedia.org/wiki/' + name + '" target="_blank">' + value + '</a>'
                        except:
                            pass
                    html_content += '<tr><th>' + key + '</th><td>' + value + '</td></tr>'
            html_content += '</table><hr>'
        return html_content

    def construct_strava_table(self, segment):
        html_content = ''
        if segment is not None:
            html_content = '<hr><table>'
            html_content += '<tr><th>' + "Distance" + '</th><td>' + str(segment.distance) + '</td></tr>'
            html_content += '<tr><th>' + "Elev Diff" + '</th><td>' + str(segment.elev_difference) + '</td></tr>'
            html_content += '<tr><th>' + "Avg Grade" + '</th><td>' + str(segment.avg_grade) + '&nbsp;%</td></tr>'
            html_content += '</table><hr>'
        return html_content

    def __repr__(self):
        return repr((self.index, self.new_gpx_index,
                     self.query_name, self.name, self.lat, self.lon, self.ele))


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
        table = [(point.latitude, point.longitude, point.elevation) for track in gpx.routes for point in track.points]
        lat, lon, ele = [x[0] for x in table], [x[1] for x in table], [x[2] for x in table]
    else:
        table = [(point.latitude, point.longitude, point.elevation) for track in gpx.tracks for segment in track.segments for point in segment.points]
        lat, lon, ele = [x[0] for x in table], [x[1] for x in table], [x[2] for x in table]

    if simplify is True:
        lat, lon, ele = uniquify(lat, lon, ele)

    # if len(lat) == 0:
    #     raise InvalidGpxFile('No track or route in gpx')

    gpx_name = track.name
    return gpx_name, lat, lon, ele


def uniquify(lat, lon, ele):
    precision = 6
    approx_coord_full = list(map(lambda x, y, z: ((round(x, precision), round(y, precision)), z), lat, lon, ele))
    in_it = set()
    res = [elem for elem in approx_coord_full if elem[0] not in in_it and not in_it.add(elem[0])]
    lat = [x[0][0] for x in res]
    lon = [x[0][1] for x in res]
    ele = [x[1] for x in res]
    return lat, lon, ele


def get_wpt_type(tag_dict):
    """
    Purpose: Récupérer le type de POI
    (Nécessaire car les requetes overpass se font maintenant en 2 différents blocs)
    Return: the waypoint types that will be written into the gpx file
			or empty string if type is not found
    """

    # OSM node values that it used to identify the waypoint type / Last values have low priority
    list_of_OSM_values = ['peak', 'saddle', 'volcano', 'attraction', 'toposcope', 'viewpoint',
        'drinking_water', 'fountain', 'glacier', 'waterfall', 'spring', 'lake',
        'guidepost', 'locality', 'observatory', 'cave_entrance',
        'chapel', 'castle', 'ruins', 'aircraft_wreck', 'toilets', 'tree', 'cairn',
        'alpine_hut', 'wilderness_hut', 'shelter', 'camp_site', 'hostel', 'hotel']
    for v in list_of_OSM_values:
        if v in list(tag_dict.values()):
            print v
            return v

    # OSM node keys that it used to identify the waypoint type (typically with someting like "arbitrary_key"="yes")
    list_of_OSM_key = ['ford', 'barrier', 'tunnel']
    for v in list_of_OSM_key:
        if v in tag_dict.keys():
            return v

    # For a particular waypoint type name that is not written in OSM db
    OSM_sac_scale = {'demanding_mountain_hiking':'T3 - ',
        'alpine_hiking':'T4 - ',
        'demanding_alpine_hiking':'T5 - ',
        'difficult_alpine_hiking':'T6 - '}
    for k, v in list(OSM_sac_scale.items()):
        if k in list(tag_dict.values()):
            return v

    OSM_badly_tagged = {'water':'lake'}
    for k, v in list(OSM_badly_tagged.items()):
        if k in list(tag_dict.values()):
            return v

    return ''


@timeit
def get_overpass_nodes(response, Pts, index_used, lat, lon, lim_dist):
    i_name = 1
    for node in response['features']:
        lat2 = node['geometry']['coordinates'][1]
        lon2 = node['geometry']['coordinates'][0]

        match, near_lon, near_lat, index, min_dist = find_nearest(lon, lat, lon2, lat2, lim_dist)
        if match:

            log.debug('Distance to node: ' + '%.2f' % (min_dist * 1e3) + ' m')
            has_name = False
            ele = '' # set default in case proper tag not found
            [lon_new, lat_new, new_gpx_index] = add_new_point(lon, lat, lon2, lat2, index)

            tag_dict = node['properties']
            query_name = get_wpt_type(tag_dict)
            if 'ele' in tag_dict:
                ele = tag_dict['ele']
            if 'name' in tag_dict:
                name = tag_dict['name']
                has_name = True
            else:
                name = query_name + str(i_name) # set by default in case proper tag not found
                i_name += 1
            # Because only 1 POI is possible per GPS point
            if index not in index_used and new_gpx_index is not None:
                log.debug(query_name + " - " + name + " - " + ele)
                Pt = Point(name, 'node', lon_new, lat_new, ele, node['id'], index, new_gpx_index, query_name, has_name, min_dist, tags=tag_dict)
                Pts.append(Pt)
                index_used.append(index)
            else:
                log.debug('/!\ Node index already used: ' + query_name + " - " + name + " - " + ele)
    return Pts


@timeit
def get_overpass_ways(response, Pts, index_used, lat, lon, lim_dist):
    """
    Purpose: Return way features close to the gpx route from the overpass query
    Inputs:
        - response: overpass response (json format)
        - Pts: The waypoints
        - index_used: The gpx index point(s) linked to a waypoint
        - lat
        - lon
        - lim_dist
    Return: list of waypoints with attributes
    """
    i_name = 1
    for way in response['features']:

        table = [(coord[0], coord[1]) for coord in way['geometry']['coordinates']]
        lon2, lat2 = [x[0] for x in table], [x[1] for x in table]
        match, near_lon, near_lat, index = find_nearest_way(lon, lat, lon2, lat2, lim_dist)

        if match == 1:
            tag_dict = way['properties']
            query_name = get_wpt_type(tag_dict)
            ele = '' # set default in case proper tag not found
            has_name = False
            if 'name' in tag_dict:
                name = tag_dict['name']
                has_name = True
            if 'ele' in tag_dict:
                ele = tag_dict['ele']

            [lon_new, lat_new, new_gpx_index] = add_new_point(lon, lat, near_lon, near_lat, index)
            if not has_name:
                name = query_name + str(i_name) # set by default in case proper tag not found
                i_name += 1

            # Because only 1 POI is possible per GPS point
            if index not in index_used and new_gpx_index is not None:
                log.debug(query_name + " - " + name)
                Pt = Point(name, 'way', lon_new, lat_new, ele, way['id'], index, new_gpx_index, query_name, has_name, 0, tags=tag_dict) # todo lim dist
                Pts.append(Pt)
                index_used.append(index)
            else:
                log.debug('/!\ Node index already used: ' + query_name + " - " + name + " - " + ele)
    return Pts


class TokenException( Exception ): pass


@timeit
def get_strava_segments(box, activity_type='running'):
    response = None
    try:
        client = Client(access_token=private_values.ACCESS_TOKEN)
        response = client.explore_segments(box.bounds, activity_type=activity_type)
    except Exception:
        err = TokenException( "Invalid Strava token. Get a valid API key from Strava and replace the ACCESS_TOKEN value in 'private_values.py'" )
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
            log.debug('Distance to node: ' + '%.2f' % (min_dist * 1e3) + ' m')
            [lon_new, lat_new, new_gpx_index] = add_new_point(lon, lat, lon_start, lat_start, index)
            query_name = 'strava_start'
            name = 'Start ' + segment.name

            # Because only 1 POI is possible per GPS point
            if index not in index_used and new_gpx_index is not None:
                log.debug(query_name + " - " + name)
                Pt = Point(name, 'strava', lon_new, lat_new, '', segment.id, index, new_gpx_index, query_name, True, min_dist, tags=segment)
                Pts.append(Pt)
                index_used.append(index)
            else:
                log.debug('/!\ Node index already used: ' + query_name + " - " + name)


            [lon_new, lat_new, new_gpx_index] = add_new_point(lon, lat, lon_end, lat_end, index2)
            query_name = 'strava_end'
            name = 'End ' + segment.name

            # Because only 1 POI is possible per GPS point
            if index2 not in index_used and new_gpx_index is not None:
                log.debug(query_name + " - " + name)
                Pt = Point(name, 'strava', lon_new, lat_new, '', segment.id, index2, new_gpx_index, query_name, True, min_dist, tags=segment)
                Pts.append(Pt)
                index_used.append(index2)
            else:
                log.debug('/!\ Node index already used: ' + query_name + " - " + name)

    return Pts


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
        log.debug('Distance to way: ' + '%.2f' % (min(dist2)*1e3) + ' m')

    return(match, lon[i], lat[i], i)


def add_new_point(lon, lat, lon2, lat2, index):
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


@timeit
def overpass_query(box, query, responseformat="geojson"):

    #   api = overpass.API()
    #   Default : http://overpass-api.de/api/interpreter
    response = None
    api = overpass.API(endpoint='http://api.openstreetmap.fr/oapi/interpreter')
    # api = overpass.API()
    overpass_query_str = '('
    for q in query:
        overpass_query_str += q + '('+ box.bounds_str + '); '
    overpass_query_str += ');'
    replied = False
    i = 1 # index while (max 5)
    # print overpass_query_str
    while (not replied) and (i < 5):
        try:
            response = api.Get(overpass_query_str, responseformat="geojson")
            save_it = False # For debug
            if responseformat is 'xml' and save_it:
                with open("Overpass.xml", "w") as f:
                    f.write(response.encode('utf-8'))
            elif responseformat is 'geojson' and save_it:
                with open("Overpass.geojson", "w") as f:
                    json.dump(response, f)
            replied = True
        except Exception as err:
            print(err)
            log.warning('Overpass is not responding')
            i += 1
            time.sleep(2)
            log.warning('Switch to default API endpoint')
            api = overpass.API()
            # print 'MultipleRequestsError'
    return response


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


def construct_overpass_query(query_lst, query_type, wpt_json, with_name):

    if wpt_json is not None:
        unquoted = urllib.unquote(wpt_json)
        unquoted = unquoted.replace("\\"," ")
        wpts = json.loads(unquoted)

    dict_query_nodes = {
        'saddle':'node["natural"="saddle"]',
        'peak':'node["natural"="peak"]',
        # 'peak':'node["natural"="volcano"]',
        'waterfall':'node["waterway"="waterfall"]',
        # 'waterfall':'node["natural"="waterfall"]',
        'guidepost':'node["information"="guidepost"]',
        'cave_entrance':'node["natural"="cave_entrance"]',
        'viewpoint':'node["tourism"="viewpoint"]["map_type"!="toposcope"]',
        'toposcope':'node["map_type"="toposcope"]',
        'drinking_water':'node["amenity"="drinking_water"]',
        'fountain':'node["amenity"="fountain"]',
        'alpine_hut':'node["tourism"="alpine_hut"]',
        'wilderness_hut':'node["tourism"="wilderness_hut"]',
        'shelter':'node["amenity"="shelter"]',
        'tree':'node["natural"="tree"]["name"]',
        'aircraft_wreck':'node["historic"="aircraft_wreck"]["aircraft_wreck"]',
        'barrier':'node["barrier"]["barrier"!="bollard"]',
        'chapel':'node["building"="chapel"]',
        'ford':'node["ford"="yes"]',
        'ruins':'node["historic"="ruins"]',
        'castle':'node["historic"="castle"]',
        'toilets':'node["amenity"="toilets"]',
        'attraction':'node["tourism"="attraction"]',
        'spring':'node["natural"="spring"]',
        'cairn':'node["man_made"="cairn"]',
        'locality':'node["place"="locality"]',
        'camp_site':'node["tourism"="camp_site"]',
        'hostel':'node["tourism"="hostel"]',
        'hotel':'node["tourism"="hotel"]'
        }

    dict_query_ways = {
        'alpine_hut':'way["tourism"="alpine_hut"]',
        'wilderness_hut':'way["tourism"="wilderness_hut"]',
        'lake':'way["water"="lake"]',
        # 'lake':'way["natural"="water"]["water"!~".*"]["name"~"[lL]ac"]',
        'glacier':'way["natural"="glacier"]',
        'chapel':'way["building"="chapel"]',
        'observatory':'way["man_made"="observatory"]',
        'shelter':'way["amenity"="shelter"]',
        'tunnel':'way["tunnel"="yes"]',
        'camp_site':'way["tourism"="camp_site"]',
        'hostel':'way["tourism"="hostel"]',
        'hotel':'way["tourism"="hotel"]'}

    if query_type is 'node':
        dict_query = dict_query_nodes
    else:
        dict_query = dict_query_ways

    if wpt_json is None:
        for wpt, query_str in list(dict_query.items()):
            query_lst.append(query_str)
        return query_lst

    for wpt, query_str in list(dict_query.items()):
        if wpt in wpts:
            if with_name is True:
                query_str = query_str + '["name"]'
            else:
                query_str = query_str + '["name"!~".*"]'
            query_lst.append(query_str)

    return query_lst


def add_custom_overpass_query(query_lst, query_type, overpass_custom_str):
    if overpass_custom_str is not None:
        unquoted = urllib.unquote(overpass_custom_str)
        if re.match(query_type + '\["(.)+"([=~])"(.)+"\](.)*', unquoted):
            query_lst.append(unquoted)
    return query_lst


def osm_wpt(fpath, gpxoutputname='out.gpx', lim_dist=0.05, keep_old_wpt=False, reverse=False,
    wpt_json=None, wpt_no_name_json=None, overpass_custom_str=None, strava_segment=None):
    '''
    lim_dist in kilometers (0.05 #default)
    keep_old_wpt (False #defaut)
    '''

    log.basicConfig(filename=LOGFILE, level=log.WARNING)
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

        x = 2;
        y = 2;
        width = box.east - box.west
        heigth = box.north - box.south
        small_box = Box(lon, lat)
        for i in range(x):
            small_box.north = box.north - heigth/x * (i)
            small_box.south = box.north - heigth/x * (i+1)
            for j in range(y):
                small_box.east = box.east - width/y * (j)
                small_box.west = box.east - width/y * (j+1)
                response = get_strava_segments(small_box, activity_type=strava_segment)
                if response is not None:
                     Pts = get_segments_pts(response, Pts, index_used, lat, lon, lim_dist)
                     print "Number of segments: " + str(len(Pts))


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
    # osm_wpt(fpath, gpxoutputname=fpath_out, strava_segment="running")
