#!/usr/bin/env python
# -*- coding: utf-8 -*-


import re
import time
import json
import urllib
import overpass                         # https://github.com/mvexel/overpass-api-python-wrapper
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


def get_wpt_type(tag_dict):
    """
    Purpose: Recuperer le type de POI
    (Necessaire car les requetes overpass se font maintenant en 2 differents blocs)
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

            # log.debug('Distance to node: ' + '%.2f' % (min_dist * 1e3) + ' m')
            has_name = False
            ele = '' # set default in case proper tag not found
            [lon_new, lat_new, new_gpx_index] = add_new_coordinate(lon, lat, lon2, lat2, index)

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
                # log.debug(query_name + " - " + name + " - " + ele)
                Pt = waypoint.Waypoint(name, 'node', lon_new, lat_new, ele, node['id'], index, new_gpx_index,
                                       query_name, has_name, min_dist, tags=tag_dict)
                Pts.append(Pt)
                index_used.append(index)
            else:
                # log.debug('/!\ Node index already used: ' + query_name + " - " + name + " - " + ele)
                pass

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

            [lon_new, lat_new, new_gpx_index] = add_new_coordinate(lon, lat, near_lon, near_lat, index)
            if not has_name:
                name = query_name + str(i_name) # set by default in case proper tag not found
                i_name += 1

            # Because only 1 POI is possible per GPS point
            if index not in index_used and new_gpx_index is not None:
                # log.debug(query_name + " - " + name)
                Pt = waypoint.Waypoint(name, 'way', lon_new, lat_new, ele, way['id'], index, new_gpx_index,
                                       query_name, has_name, 0, tags=tag_dict) # todo lim dist
                Pts.append(Pt)
                index_used.append(index)
            else:
                # log.debug('/!\ Node index already used: ' + query_name + " - " + name + " - " + ele)
                pass

    return Pts


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
            # log.warning('Overpass is not responding')
            i += 1
            time.sleep(2)
            # log.warning('Switch to default API endpoint')
            api = overpass.API()
            # print 'MultipleRequestsError'
    return response


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