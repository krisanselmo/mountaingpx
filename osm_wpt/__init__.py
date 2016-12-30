# -*- coding: utf-8 -*-
"""
Created on Mon Oct 17 15:28:58 2016

@author: christophe.anselmo@gmail.com


TODO:
    - Add the possibility to query ways with overpass
            |--> Fix double wpt
    - Keep old WPT (partially functional)
    - Add x kilometers before ending
        Last 2 km
        Last km

"""

import gpxpy      # https://github.com/tkrajina/gpxpy
import overpass   # https://github.com/mvexel/overpass-api-python-wrapper
import osmapi     # https://github.com/metaodi/osmapi
import time
import sys
import logging as log
import xml.etree.cElementTree as ET
from math import radians, cos, sin, asin, sqrt
import numpy as np
import multiprocessing
import orderedset as ordset



def timeit(f):
    def timed(*args, **kw):
        ts = time.time()
        result = f(*args, **kw)
        te = time.time()
        print("function time {} : {} sec".format(f.__name__, te - ts))
        return result

    return timed


class Point(object):
    def __init__(self, name, lon, lat, ele, node_id, index, new_gpx_index, query_name, has_name, min_dist):
        self.name = name
        self.lat = lat
        self.lon = lon

        self.query_name = query_name
        self.osm_node_id = node_id
        self.index = index
        self.new_gpx_index = new_gpx_index
        self.has_name = has_name
        self.min_dist = min_dist

        try:
            self.ele = float(ele)
        except ValueError:
            self.ele = 0

    def __repr__(self):
        return repr((self.osm_node_id, self.index, self.new_gpx_index,
                     self.query_name, self.name, self.lat, self.lon, self.ele))

def parse_route(gpx, simplify=False):
    # A for loop + list.append is the worst thing you can do for building a list (in term of performances). Huge lose of
    # time:
    #   - init an empty list
    #   - then, nested for loop --> catastrophic
    #   - then .append (get the size of the list + allocate new mem + append + calculate new size... + other deep python
    #     rubbishes (garbage collection...).
    # Always use a comprehension list.
    #   - pre-compiled function
    #   - simple, one line.
    #   - CPU and memory efficient
    if not gpx.tracks:
        table = [(point.latitude, point.longitude, point.elevation) for track in gpx.routes for point in track.points]
        lat, lon, ele = [x[0] for x in table], [x[1] for x in table], [x[2] for x in table]
    else:
        table = [(point.latitude, point.longitude, point.elevation) for track in gpx.tracks for segment in track.segments for point in segment.points]
        lat, lon, ele = [x[0] for x in table], [x[1] for x in table], [x[2] for x in table]

    if simplify is True:
        lat2, lon2, ele2 = uniquify(lat, lon, ele)

    gpx_name = track.name
    print(gpx_name)
    return gpx_name, lat, lon, ele

# def parse_route(gpx, simplify=False):
#     lat = []
#     lon = []
#     ele = []

#     if not gpx.tracks:
#         for track in gpx.routes:
#             for point in track.points:
#                 lat.append(point.latitude)
#                 lon.append(point.longitude)
#                 ele.append(point.elevation)
#     else:
#         for track in gpx.tracks:
#             for segment in track.segments:
#                 for point in segment.points:
#                     lat.append(point.latitude)
#                     lon.append(point.longitude)
#                     ele.append(point.elevation)


#     if len(lat) == 0:
#         raise InvalidGpxFile('No track or route in gpx')

#     if simplify is True:
#         lat, lon, ele = uniquify(lat, lon, ele)

#     gpx_name = track.name
#     return(gpx_name, lat, lon, ele)
    
    
def uniquify(lat, lon, ele):
    # J'ai vomi (et pas parce que j'etais content)
    precision = 6
    approx_coord_full = map(lambda x, y, z: ((round(x, precision), round(y, precision)), z), lat, lon, ele)
    in_it = set()
    res = [elem for elem in approx_coord_full if elem[0] not in in_it and not in_it.add(elem[0])]
    lat = [x[0][0] for x in res]
    lon = [x[0][1] for x in res]
    ele = [x[1] for x in res]
    return lat, lon, ele

def macro_type(query_name, tag, key, value):
    if (tag.attrib['k'] == key) and (tag.attrib['v'] == value):
        query_name = value
    return query_name


def get_POI_type(tag, query_name):
    """
    

    """

    query_name = macro_type(query_name, tag, 'waterway', 'waterfall')
    query_name = macro_type(query_name, tag, 'natural', 'waterfall')

    # if (tag.attrib['k'] == "tourism") and (tag.attrib['v'] == "viewpoint"):
    #     if not ((tag.attrib['k'] == "map_type") and (tag.attrib['v'] == "toposcope")):
    #         query_name = 'viewpoint'

    if (tag.attrib['k'] == "natural") and (tag.attrib['v'] == "cave_entrance"):
        query_name = 'cave'
    if (tag.attrib['k'] == "amenity") and (tag.attrib['v'] == "drinking_water"):
        query_name = 'water'
    if (tag.attrib['k'] == "information") and (tag.attrib['v'] == "guidepost"):
        query_name = 'guidepost' 
    if (tag.attrib['k'] == "ford") and (tag.attrib['v'] == "yes"):
        query_name = 'ford'     

    query_name = macro_type(query_name, tag, 'tourism', 'viewpoint')
    query_name = macro_type(query_name, tag, 'map_type', 'toposcope')
    query_name = macro_type(query_name, tag, 'amenity', 'fountain')
    query_name = macro_type(query_name, tag, 'tourism', 'alpine_hut')
    query_name = macro_type(query_name, tag, 'tourism', 'wilderness_hut')
    query_name = macro_type(query_name, tag, 'water', 'lake')
    query_name = macro_type(query_name, tag, 'natural', 'glacier')
    query_name = macro_type(query_name, tag, 'natural', 'tree')
    query_name = macro_type(query_name, tag, 'building', 'chapel')
    query_name = macro_type(query_name, tag, 'historic', 'aircraft_wreck') 
    query_name = macro_type(query_name, tag, 'natural', 'saddle')
    query_name = macro_type(query_name, tag, 'natural', 'peak')


    if (tag.attrib['k'] == "barrier"):
        query_name = 'barrier' 

    # if (tag.attrib['k'] == "sac_scale") and (tag.attrib['v'] == "demanding_mountain_hiking"):
    #     query_name = 'T3' 

    if (tag.attrib['k'] == "sac_scale") and (tag.attrib['v'] == "alpine_hiking"):
        query_name = 'T4' 

    if (tag.attrib['k'] == "sac_scale") and (tag.attrib['v'] == "demanding_alpine_hiking"):
        query_name = 'T5' 

    if (tag.attrib['k'] == "sac_scale") and (tag.attrib['v'] == "difficult_alpine_hiking"):
        query_name = 'T6' 


    return query_name

def get_overpass_feature(Pts, index_used, lat, lon, lim_dist):
    tree = ET.parse("Overpass.xml")
    root = tree.getroot()
    allnodes = root.findall('node')
    i_name = 1
    query_name = ''

    for node in allnodes:
        lat2 = float(node.get('lat'))
        lon2 = float(node.get('lon'))
        node_id = node.get('id')

        match, near_lon, near_lat, index, min_dist = find_nearest(lon, lat, lon2, lat2, lim_dist)
        if match:
            log.debug('Distance to node: ' + '%.2f' % (min_dist * 1e3) + ' m')
            has_name = False
            [lon_new, lat_new, new_gpx_index] = add_new_point(lon, lat, lon2, lat2, index)
            ele = '' # set default in case proper tag not found

            for tag in node.findall('tag'):
                if tag.attrib['k'] == 'name':
                    name = tag.attrib['v']
                    has_name = True
                if tag.attrib['k'] == 'ele':
                    ele = tag.attrib['v']
                query_name = get_POI_type(tag, query_name)

            if not has_name:
                name = query_name + str(i_name) # set by default in case proper tag not found
                i_name += 1

            # Because only 1 POI is possible per GPS point

            if index not in index_used and new_gpx_index is not None:
                log.debug(query_name + " - " + name + " - " + ele)
                Pt = Point(name, lon_new, lat_new, ele, node_id, index, new_gpx_index, query_name, has_name, min_dist)
                Pts.append(Pt)
                index_used.append(index)
            else:
                log.debug('/!\ Node index already used: ' + query_name + " - " + name + " - " + ele)
    return Pts


def get_overpass_way_feature(Pts, index_used, lat, lon, lim_dist):
    tree = ET.parse("Overpass.xml")
    root = tree.getroot()
    allways = root.findall('way')
    i_name = 1
    query_name = ''
    api = osmapi.OsmApi()

    for way in allways:

        for tag in way.findall('tag'):
            if tag.attrib['k'] == 'name':
                name = tag.attrib['v']
                has_name = True
            query_name = get_POI_type(tag, query_name)

        way_id = way.get('id')
        nodes_id = api.WayGet(way_id)
        nodes = api.NodesGet(nodes_id['nd'])
        lat2 = []
        lon2 = []
        for node_id in nodes:
            lat2.append(nodes[node_id]['lat'])
            lon2.append(nodes[node_id]['lon'])
        (match, near_lon, near_lat, index) = find_nearest_way(lon, lat, lon2, lat2, lim_dist)

        if match == 1:
            has_name = False
            [lon_new, lat_new, new_gpx_index] = add_new_point(lon, lat, near_lon, near_lat, index)
            name = query_name + str(i_name) # set by default in case proper tag not found
            ele = '' # set default in case proper tag not found

            for tag in way.findall('tag'):
                if tag.attrib['k'] == 'name':
                    name = tag.attrib['v']
                    has_name = True

            if not has_name:
                name = query_name + str(i_name) # set by default in case proper tag not found
                i_name += 1


            # Because only 1 POI is possible per GPS point
            if index not in index_used and new_gpx_index is not None:
                log.debug(query_name + " - " + name)
                Pt = Point(name, lon_new, lat_new, ele, nodes_id['nd'][-1], index, new_gpx_index, query_name, has_name, 0) # todo lim dist
                Pts.append(Pt)
                index_used.append(index)
            else:
                log.debug('/!\ Node index already used: ' + query_name + " - " + name + " - " + ele)
    return Pts


def find_nearest(lon, lat, lon2, lat2, lim_dist):
    """
    Purpose - Find if an OSM node matches with the gpx route and return the nearest
    coordinates and its index
    """
    dist = map(lambda x, y: (haversine(x, y, lon2, lat2)), lon, lat)
    dist_min = min(dist)
    i = dist.index(dist_min)
    with open("nearest_new.txt", "a") as f:
        f.write(str([dist_min < lim_dist, lon[i], lat[i], i, dist_min]) + '\n')
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
    if (index == 0) or (index+1 == len(lat)):
        return None, None, None

    d_prev = haversine(lon[index-1], lat[index-1], lon2, lat2)
    d_next = haversine(lon[index+1], lat[index+1], lon2, lat2)

    if d_prev < d_next:
        i = index-1
    else:
        i = index+1

    [lon_new, lat_new, exist] = get_perp(lon[i], lat[i], lon[index], lat[index], lon2, lat2)
    if exist == 1:
        i = index
    precision = 6
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
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    # haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat*0.5)**2 + cos(lat1) * cos(lat2) * sin(dlon*0.5)**2
    c = 2.0 * asin(sqrt(a))
    r = 6371.0 # Radius of earth in kilometers. Use 3956 for miles
    return c * r


def overpass_query(lon, lat, query):
    margin = 0.001
    minlon = min(lon) - margin
    maxlon = max(lon) + margin
    minlat = min(lat) - margin
    maxlat = max(lat) + margin
#    api = overpass.API()
#   Default : http://overpass-api.de/api/interpreter
    api = overpass.API(endpoint='http://api.openstreetmap.fr/oapi/interpreter')

    pos_str = str(minlat) + ',' + str(minlon) + ',' +\
    str(maxlat) + ',' + str(maxlon)

    overpass_query_str = '('
    for q in query:
        overpass_query_str += q + '('+ pos_str + '); '

    overpass_query_str += ');'
    # print overpass_query_str
    is_replied = 0
    i = 1 # index while (max 5)
    while (is_replied != 1) and (i < 5):
        try:
            response = api.Get(overpass_query_str, responseformat="xml")
            with open("Overpass.xml", "wb") as f:
                f.write(response.encode('utf-8'))
            is_replied = 1
        except Exception as err:
            print(err)
            log.warning('Overpass ne repond pas')
            # raise ValueError("Overpass ne repond pas")
            i += 1
            time.sleep(2)
            # print 'MultipleRequestsError'
    

def build_and_save_gpx(gpx_data, gpx_name, Pts, lat, lon, ele, index_used, gpxoutputname, keep_old_wpt=True):
    gpx = gpxpy.gpx.GPX()
    # Create first track in our GPX:
    gpx_track = gpxpy.gpx.GPXTrack()
    gpx_track.name = gpx_name
    gpx.tracks.append(gpx_track)
    gpx_segment = gpxpy.gpx.GPXTrackSegment()
    gpx_track.segments.append(gpx_segment)


    for i in range(len(lat)):
        if i in index_used:
            pt = filter(lambda pt: pt.index == i, Pts)
            P = pt[0]
            if (P.new_gpx_index < i) and P.new_gpx_index is not None:
                gpx_segment.points.append(gpxpy.gpx.GPXTrackPoint(P.lat, P.lon, elevation=ele[i]))
        gpx_segment.points.append(gpxpy.gpx.GPXTrackPoint(lat[i], lon[i], elevation=ele[i]))
        if i in index_used:

            if (P.new_gpx_index > i) and P.new_gpx_index is not None:
                gpx_segment.points.append(gpxpy.gpx.GPXTrackPoint(P.lat, P.lon, elevation=ele[i]))

    if keep_old_wpt is True:
        for waypoint in gpx_data.waypoints:
            gpx.waypoints.append(waypoint)



    all_waypoint = True

    for Pt in Pts:
        if Pt.has_name or all_waypoint:
            #ok = filter(lambda wpt: round(wpt.latitude*1e5) == round(Pt.lat*1e5), gpx_data.waypoints)
            #if len(ok) == 0:
            # log.info(Pt)
            gpx.waypoints.append(gpxpy.gpx.GPXWaypoint(
            Pt.lat, Pt.lon, elevation=Pt.ele, name=Pt.name,
            symbol=Pt.query_name, type=Pt.query_name))
        


    with open(gpxoutputname, 'w') as f:
        f.write(gpx.to_xml())

    # togpx = gpx.to_xml()
    # tree = ET.parse(togpx)
    # tree.find('.//creator').text = 'test'
    # f.write(tree)
    # f.close()
    # tree.write(gpxoutputname)


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

def osm_wpt(fpath, lim_dist=0.05, keep_old_wpt=False, gpxoutputname='out.gpx'):
    '''
    lim_dist in kilometers (0.05 #default)
    keep_old_wpt (False #defaut)
    '''

    log.basicConfig(filename='osm_wpt.log', level=log.DEBUG)
    log.info('Started')

    with open(fpath, 'r') as gpx_file:
        gpx = gpxpy.parse(gpx_file)
        (gpx_name, lat, lon, ele) = parse_route(gpx)

    # Change start point manually
    lat, lon, ele = change_route(lat, lon, ele, reverse=False, index=None)

    index_used = []
    Pts = []

    query = []
    query.append('node["natural" = "saddle"]')
    query.append('node["natural" = "peak"]')
    query.append('node["waterway"="waterfall"]')
    query.append('node["natural"="waterfall"]')
    query.append('node["information"="guidepost"]')
    query.append('node["natural"="cave_entrance"]')
    query.append('node["tourism"="viewpoint"]["map_type"!="toposcope"]')
    query.append('node["map_type"="toposcope"]')
    query.append('node["amenity"="drinking_water"]')
    query.append('node["amenity"="fountain"]')
    query.append('node["tourism"="alpine_hut"]')
    query.append('node["tourism"="wilderness_hut"]')
    query.append('node["natural"="tree"]["name"]')
    query.append('node["historic"="aircraft_wreck"]["aircraft_wreck"]')
    query.append('node["barrier"]["barrier"]')
    query.append('node["building"="chapel"]')   # Just in case
    query.append('node["ford"="yes"]')   




    print('Overpass Node start')
    overpass_query(lon, lat, query)
    print('Overpass Node done')
    Pts = get_overpass_feature(Pts, index_used, lat, lon, lim_dist)

    # Ways
    query = []
    query.append('way["tourism"="alpine_hut"]')
    query.append('way["tourism"="wilderness_hut"]')
    query.append('way["water"="lake"]')
    query.append('way["natural"="glacier"]')
    query.append('way["building"="chapel"]')

    # query.append('way["highway"="path"]["sac_scale"]')



    print('Overpass way start')
    overpass_query(lon, lat, query)
    print('Overpass way done')
    Pts = get_overpass_way_feature(Pts, index_used, lat, lon, lim_dist)


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
