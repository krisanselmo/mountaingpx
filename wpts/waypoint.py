#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Created on Mon Oct 17 15:28:58 2016

@author: christophe.anselmo@gmail.com


"""


class Waypoint(object):
    def __init__(self, name, wpt_type, lon, lat, ele, object_id, index, new_gpx_index, query_name, has_name,
                 min_dist, tags=None):
        self.name = name
        self.osmtype = wpt_type
        self.lat = lat
        self.lon = lon
        self.query_name = query_name
        self.make_table(wpt_type, object_id, tags)
        self.index = index
        self.new_gpx_index = new_gpx_index
        self.has_name = has_name
        self.min_dist = min_dist
        try:
            self.ele = float(ele)
        except ValueError:
            self.ele = 0


    def make_table(self, wpt_type, object_id, tags):
        if wpt_type in ['node', 'way']:
            self.url = 'http://www.openstreetmap.org/' + wpt_type + '/' + str(object_id)
            html_content = self.construct_osm_table(tags)
        elif wpt_type is 'strava':
            self.url = 'https://www.strava.com/segments/' + str(object_id)
            html_content = self.construct_strava_table(tags)
        else:
            self.url = ''
            html_content = ''
        self.description = html_content + '<a href="' + self.url + '" target="_blank">' + str(object_id) + '</a>'


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
                        value = '<a href="https://www.wikidata.org/wiki/' + value + '" target="_blank">' +\
                                value + '</a>'
                    if key == 'wikipedia':
                        try:
                            [lang, name] = value.split(':')
                            value = '<a href="https://' + lang + '.wikipedia.org/wiki/' + name +\
                                    '" target="_blank">' + value + '</a>'
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
            html_content += '<tr><th>' + "Avg Grade" + '</th><td>' + str(
                segment.avg_grade) + '&nbsp;%</td></tr>'
            html_content += '</table><hr>'
        return html_content


    def __repr__(self):
        return repr((self.index, self.new_gpx_index,
                     self.query_name, self.name, self.lat, self.lon, self.ele))