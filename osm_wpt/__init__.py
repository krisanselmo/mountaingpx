# -*- coding: utf-8 -*-
"""
Created on Mon Oct 17 15:28:58 2016

@author: christophe.anselmo@gmail.com


"""

import gpxpy      # https://github.com/tkrajina/gpxpy
import overpass   # https://github.com/mvexel/overpass-api-python-wrapper
import time
import sys
import logging as log
import json
from math import radians, cos, sin, asin, sqrt


def timeit(f):
    def timed(*args, **kw):
        ts = time.time()
        result = f(*args, **kw)
        te = time.time()
        print("function time {} : {} sec".format(f.__name__, te - ts))
        return result
    return timed


class Point(object):
    def __init__(self, name, osmtype, lon, lat, ele, node_id, index, new_gpx_index, query_name, has_name, min_dist):
        self.name = name
        self.osmtype = osmtype
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
    print(gpx_name)
    return gpx_name, lat, lon, ele

    
def uniquify(lat, lon, ele):
    precision = 6
    approx_coord_full = map(lambda x, y, z: ((round(x, precision), round(y, precision)), z), lat, lon, ele)
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
    Return: the waypoint type that will be written into the gpx file
    """

    query_name = ''
    # OSM node values that it used to identify the waypoint type / Last values have low priority
    list_of_OSM_values = ['aircraft_wreck', 'alpine_hut', 
        'castle', 'cave_entrance', 'chapel', 'drinking_water', 'fountain', 'glacier', 
        'guidepost', 'lake', 'observatory', 'peak', 'ruins', 
        'saddle', 'shelter', 'spring', 'toilets', 'toposcope', 'tree', 'viewpoint', 'volcano',
        'waterfall', 'wilderness_hut', 'cairn']
    for q in list_of_OSM_values:
        if q in tag_dict.values():
            query_name = q
            return query_name

    # OSM node keys that it used to identify the waypoint type (typically with someting like "arbitrary_key"="yes")
    list_of_OSM_key = ['ford', 'barrier']
    for q in list_of_OSM_key:
        if q in tag_dict.keys():
            query_name = q
            return query_name

    # For a particular waypoint type name that is not written in OSM db 
    OSM_sac_scale = {'demanding_mountain_hiking':'T3 - ',
        'alpine_hiking':'T4 - ',
        'demanding_alpine_hiking':'T5 - ',
        'difficult_alpine_hiking':'T6 - '}
    for k, v in OSM_sac_scale.items():
        if k in tag_dict.values():
            query_name = v
            return query_name

    OSM_badly_tagged = {'water':'lake'}
    for k, v in OSM_badly_tagged.items():
        if k in tag_dict.values():
            query_name = v
            return query_name        

    # Return the same "query_name" that the input one if type is not found
    return query_name


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
                Pt = Point(name, 'node', lon_new, lat_new, ele, node['id'], index, new_gpx_index, query_name, has_name, min_dist)
                Pts.append(Pt)
                index_used.append(index)
            else:
                log.debug('/!\ Node index already used: ' + query_name + " - " + name + " - " + ele)
    return Pts


@timeit
def get_overpass_ways(response, Pts, index_used, lat, lon, lim_dist):
    """
    Purpose: Return way faetures close to the gpx route from the overpass query
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
                Pt = Point(name, 'way', lon_new, lat_new, ele, way['id'], index, new_gpx_index, query_name, has_name, 0) # todo lim dist
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


def overpass_query(lon, lat, query, responseformat="geojson"):
    margin = 0.001
    minlon = min(lon) - margin
    maxlon = max(lon) + margin
    minlat = min(lat) - margin
    maxlat = max(lat) + margin
    #   api = overpass.API()
    #   Default : http://overpass-api.de/api/interpreter
    response = None
    api = overpass.API(endpoint='http://api.openstreetmap.fr/oapi/interpreter')

    pos_str = str(minlat) + ',' + str(minlon) + ',' +\
    str(maxlat) + ',' + str(maxlon)
    overpass_query_str = '('
    for q in query:
        overpass_query_str += q + '('+ pos_str + '); '
    overpass_query_str += ');'
    is_replied = 0
    i = 1 # index while (max 5)
    while (is_replied != 1) and (i < 5):
        try:
            response = api.Get(overpass_query_str, responseformat="geojson")
            saveit = False
            if responseformat is 'xml' and saveit:
                with open("Overpass.xml", "w") as f:
                    f.write(response.encode('utf-8'))
            elif responseformat is 'geojson' and saveit:
                with open("Overpass.geojson", "w") as f:
                    json.dump(response, f)
            is_replied = 1
        except Exception as err:
            print(err)
            log.warning('Overpass ne repond pas')
            # raise ValueError("Overpass ne repond pas")
            i += 1
            time.sleep(2)
            # print 'MultipleRequestsError'
    return response
    

def build_and_save_gpx(gpx_data, gpx_name, Pts, lat, lon, ele, index_used, gpxoutputname, keep_old_wpt=True):
    gpx = gpxpy.gpx.GPX()
    # Create first track in our GPX:
    gpx_track = gpxpy.gpx.GPXTrack()
    gpx_track.name = gpx_name
    gpx_track.link = 'http://localhost:5000/'
    gpx_track.source = 'Mountain GPX'
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

    all_waypoints = True

    for Pt in Pts:
        if Pt.has_name or all_waypoints:
            #ok = filter(lambda wpt: round(wpt.latitude*1e5) == round(Pt.lat*1e5), gpx_data.waypoints)
            #if len(ok) == 0:
            # log.info(Pt)
            gpx.waypoints.append(gpxpy.gpx.GPXWaypoint(
            Pt.lat, Pt.lon, elevation=Pt.ele, name=Pt.name,
            symbol=Pt.query_name, type=Pt.query_name))
        
    with open(gpxoutputname, 'w') as f:
        f.write(gpx.to_xml())


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


def osm_wpt(fpath, gpxoutputname='out.gpx', lim_dist=0.05, keep_old_wpt=False):
    '''
    lim_dist in kilometers (0.05 #default)
    keep_old_wpt (False #defaut)
    '''

    log.basicConfig(filename='osm_wpt.log', level=log.WARNING)
    log.info('Started')

    with open(fpath, 'r') as gpx_file:
        gpx = gpxpy.parse(gpx_file)
        (gpx_name, lat, lon, ele) = parse_route(gpx)

    # Change start point manually
    lat, lon, ele = change_route(lat, lon, ele, reverse=False, index=None)

    index_used = []
    Pts = []

    # Nodes
    query = []
    query.append('node["natural"="saddle"]')
    query.append('node["natural"="peak"]')
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
    query.append('node["amenity"="shelter"]')
    query.append('node["natural"="tree"]["name"]')
    query.append('node["historic"="aircraft_wreck"]["aircraft_wreck"]')
    query.append('node["barrier"]["barrier"!="bollard"]')   # A spécifier un peu plus
    query.append('node["building"="chapel"]')
    query.append('node["ford"="yes"]')   
    query.append('node["historic"="ruins"]')   
    query.append('node["historic"="castle"]')   
    query.append('node["amenity"="toilets"]')   
    query.append('node["natural"="volcano"]')
    query.append('node["natural"="spring"]')
    query.append('node["man_made"="cairn"]')
    print('Overpass node - start')
    response = overpass_query(lon, lat, query)
    print('Overpass node - done')
    if response is not None:
        Pts = get_overpass_nodes(response, Pts, index_used, lat, lon, lim_dist)

    # Ways
    query = []
    query.append('way["tourism"="alpine_hut"]')
    query.append('way["tourism"="wilderness_hut"]')
    query.append('way["water"="lake"]')
    query.append('way["natural"="water"]["water"!~".*"]["name"~"[lL]ac"]') # For missing lake tag cases
    query.append('way["natural"="glacier"]')
    query.append('way["building"="chapel"]')
    query.append('way["man_made"="observatory"]')
    query.append('way["amenity"="shelter"]')

    # Paths
    # query.append('way["highway"="path"]["sac_scale"]["sac_scale"!="mountain_hiking"]["sac_scale"!="hiking"]')

    print('Overpass way - start')
    response = overpass_query(lon, lat, query)
    print('Overpass way - done')
    if response is not None:
        Pts = get_overpass_ways(response, Pts, index_used, lat, lon, lim_dist)


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
