#!/usr/bin/env python
# -*- coding:utf-8 -*-

import os
from flask import Flask, request, redirect, url_for, flash, send_from_directory, render_template, abort
from werkzeug.utils import secure_filename
from werkzeug import SharedDataMiddleware

import random
import osm_wpt

UPLOAD_FOLDER = 'uploads/'
OUTPUT_FOLDER = 'static/track/'
ALLOWED_EXTENSIONS = set(['gpx'])

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['OUTPUT_FOLDER'] = OUTPUT_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024

app.secret_key = 'A0Zr98j/3yX R~XHH!jmN]LWX/,?RT'

app.jinja_env.lstrip_blocks = True
app.jinja_env.trim_blocks = True


def make_dirs():
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    if not os.path.exists(OUTPUT_FOLDER):
        os.makedirs(OUTPUT_FOLDER)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1] in ALLOWED_EXTENSIONS

# -----------------------------------------------------------
@app.errorhandler(401)
@app.errorhandler(404)
@app.errorhandler(500)
def error_page(error):
    return "D'Oh! Error {}".format(error.code), error.code

# -----------------------------------------------------------
@app.route('/help', methods=['GET'])
def help():
    return render_template('help.tpl')


@app.route('/POImap', methods=['GET', 'POST'])
def POImap():
    return render_template('POImap.tpl')

# -----------------------------------------------------------
@app.route('/', methods=['GET', 'POST'])
@app.route('/track', methods=['GET', 'POST'])
@app.route('/track/<trk_num>', methods=['GET', 'POST'])
def main_page(trk_num=None):
    if request.method == 'POST':
        # check if the post request has the file part
        if 'file' not in request.files:
            flash('No file part')
            return redirect(request.url)
        file = request.files['file']
        # if user does not select file, browser also
        # submit a empty part without filename
        if file.filename == '':
            flash('No selected file')
            return redirect(request.url)
        if file and allowed_file(file.filename):

            # Save file
            filename = secure_filename(file.filename)
            try:
                make_dirs()
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
            except Exception as err:
                flash('Permission denied')
                return redirect(request.url)

            # Output file processing
            trk_num = str(len(os.listdir(OUTPUT_FOLDER)) + 1) 
            app.logger.debug(u'Track number: ' + trk_num)

            fpath = OUTPUT_FOLDER + trk_num + '.gpx'
            try:
                # TODO: AFFICHER UN LOADING
                wpts_number = osm_wpt.osm_wpt('uploads/' + filename, lim_dist=0.05, gpxoutputname=fpath)
                # app.logger.debug(u'osm_wpt script : OK')
                # app.logger.debug(u'waypoints: ' + str(wpts_number))
            except Exception as err:
                flash('GPX Error')
                # flash(err)
                app.logger.warning(u'GPX Error')
                return redirect(request.url)
    
            # print(trk_num)
            return redirect(url_for('main_page', trk_num=trk_num))
            # return redirect(url_for('main_page', trk_num=trk_num))

        else:
            flash('Not allowed file type')
            return redirect(request.url)

    if trk_num is None:
        fpath = None
    else:
        fpath = OUTPUT_FOLDER + trk_num + '.gpx'

    # Query string
    map_qstr = dict.fromkeys(['zoom', 'lat', 'lon'], None)

    # print request.args['msg']
    if request.args.get('map') is not None:
        a = request.args['map']
        b = a.split('/')
        try:
            zoom = int(b[0])
            if zoom > 18:
                map_qstr['zoom'] = None
            if zoom < 0:
                map_qstr['zoom'] = None
            map_qstr['zoom'] = zoom
            map_qstr['lat'] = float(b[1])
            map_qstr['lon'] = float(b[2])
        except:
            map_qstr['zoom'] = None
            map_qstr['lat'] = None
            map_qstr['lon'] = None

    layer_name = None
    if request.args.get('layer') is not None:
        layer_num = request.args['layer']
        try:
            if int(layer_num)>0 & int(layer_num)<9:
                options = {1 : "opentopo",
                           2 : "mapyCz",
                           3 : "osm",
                           4 : 'osmcyclemap',
                           5 : "streets",
                           6 : 'grayscale',
                           7 : 'outdoors',
                           8 : 'satellite',
                           9 : 'google',
                }
                layer_name = options[int(layer_num)]
        except:
            layer_name = None

    overlay_lst = [] 
    if request.args.get('overlay') is not None:
        overlay = request.args['overlay']
        dic = { "A": 'strava_overlay_b',
                "B": 'strava_overlay_r',
                "C": 'strava_bike_overlay',
                "D": 'lonvia_overlay',
                "E": 'mapyCz_overlay',
                "F": 'hillshade_overlay',
                "G": 'flickr',
                "H": 'overpass_parking',
                "I": 'wiki',
        }
        for k, v in dic.items():
            if k in overlay:
                overlay_lst.append(v)

    
    return render_template('main.tpl', outputfile=fpath, map_qstr=map_qstr,
        layer_qstr=layer_name, overlay_qstr=overlay_lst)




if __name__ == '__main__':
    # app.run(debug=True)
    app.run(port=80) 




'''


{# 

    https://github.com/brunob/leaflet.fullscreen
    https://keep.google.com/#NOTE/1481497142074.280328407
    https://github.com/mpetazzoni/leaflet-gpx


    Groupe Layer
    http://bl.ocks.org/ismyrnow/6123517


    - Selectionner les POI à afficher



    <!-- https://cornilyon.fr/index.php?article100/stravalib -->


    selector
    https://codepen.io/bseth99/pen/fboKH
    http://dropdownchecklist.sourceforge.net/



#}




# Hash 
# http://pythoncentral.io/hashing-files-with-python/

# Fragmentation de la carte

# Option pour virer les wpt sans nom.
# Ajout liste des WPTs avec nom

# Mettre une icone d'alerte si le nombre de waypoints dépasse la limite de suunto.


# Seuil de distance     / JS + html



################################# ICONS



    query.append('node["natural"="volcano"]')
    query.append('node["natural"="spring"]')
    query.append('node["man_made"="cairn"]')

################################# HTML

Option pour enlever les POI sans nom


RESPONSIVE
    -> Si écran petit en largeur, il faut recentrer la map

WPTS BOX 
    -> list items



################################# JS / Leaflet

https://github.com/mpetazzoni/leaflet-gpx/issues/41
Option to remove gpx layer


OVERPASS sur ways:

http://simon04.github.io/POImap/railway.html



################################# JS / Leaflet / Elevation

    -> Remove comma separator
    -> Smooth 

var n = 34523453.345
n.toLocaleString()


############################### python

TODO:
    - Keep old WPT (partially functional)
    - Add x kilometers before ending
        Last 2 km
        Last km


################################# OTHER THINGS
    ->  https://en.wikipedia.org/wiki/Map_matching

    -> pourcentage de terrain 




'''    