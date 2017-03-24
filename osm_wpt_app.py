#!/usr/bin/env python
# -*- coding:utf-8 -*-

import os
import random
from flask import Flask, request, redirect, url_for, flash, send_from_directory, render_template, abort
from werkzeug.utils import secure_filename
from werkzeug import SharedDataMiddleware
import osm_wpt

HERE = os.path.dirname(__file__)
UPLOAD_FOLDER = os.path.join(HERE, 'uploads/')
OUTPUT_FOLDER = os.path.join(HERE, 'static/track/')

ALLOWED_EXTENSIONS = set(['gpx'])

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['OUTPUT_FOLDER'] = OUTPUT_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 12 * 1024 * 1024
app.config['TEMPLATES_AUTO_RELOAD'] = True

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
@app.route('/', methods=['GET'])
def home():
    return render_template('home.tpl')

# -----------------------------------------------------------
@app.route('/help', methods=['GET'])
def help():
    return render_template('help_tab.tpl')

# -----------------------------------------------------------
@app.route('/last', methods=['GET'])
@app.route('/map/last', methods=['GET'])
def last_track():
    trk_num = str(len(os.listdir(OUTPUT_FOLDER))) 
    return redirect(url_for('main_page', trk_num=trk_num))

# -----------------------------------------------------------
@app.route('/map', methods=['GET', 'POST'])
@app.route('/map/track', methods=['GET', 'POST'])
@app.route('/map/track/<trk_num>', methods=['GET', 'POST'])
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
            except Exception as err:
                flash('Unable to create directory','error')
                return redirect(request.url)

            try:
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                print('File saved: ' + filename)
            except Exception as err:
                app.logger.error(u'Permission denied on ' + app.config['UPLOAD_FOLDER'])
                flash('Permission denied: ' + str(err),'error')
                return redirect(request.url)

            # Output file processing
            trk_num = str(len(os.listdir(OUTPUT_FOLDER)) + 1) 
            app.logger.debug(u'Track number: ' + trk_num)

            fpath = app.config['OUTPUT_FOLDER'] + trk_num + '.gpx'

            # Get cookies
            try:
                snap_distance = float(request.cookies.get('snapdistance'))
                if snap_distance > 0 and snap_distance < 1001:
                    lim_dist = snap_distance / 1000
                else:
                    lim_dist = 0.05
            except:
                lim_dist = 0.05 

            reverse = False
            if request.cookies.get('reverse') == 'true':
                print 'Invert track'
                reverse = True

            wpt = request.cookies.get('wpt')
            wpt_no_name = request.cookies.get('wpt_no_name')

            input_file = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            
            try:
                # TODO: AFFICHER UN LOADING
                wpts_number = osm_wpt.osm_wpt(input_file, lim_dist=lim_dist, gpxoutputname=fpath, 
                    reverse=reverse, wpt_json=wpt, wpt_no_name_json=wpt_no_name)
                # app.logger.debug(u'osm_wpt script : OK')
                # app.logger.debug(u'waypoints: ' + str(wpts_number))
            except Exception as err:
                flash(str(err))
                print(err)
                app.logger.warning(u'GPX Error')
                return redirect(request.url)
    
            return redirect(url_for('main_page', trk_num=trk_num))

        else:
            flash('Not allowed file type')
            return redirect(request.url)

    if trk_num is None:
        fpath = None
    else:
        # fpath = app.config['OUTPUT_FOLDER'] + trk_num + '.gpx'
        fpath = 'static/track/' + trk_num + '.gpx' 
        fpathPY = app.config['OUTPUT_FOLDER'] + trk_num + '.gpx' 
        if not os.path.isfile(fpathPY):
            fpath = None
            flash('GPX not found')

    # Query string
    map_qstr = dict.fromkeys(['zoom', 'lat', 'lon'], None)

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
                # "J": 'layer_trail_sac',
        }
        for k, v in dic.items():
            if k in overlay:
                overlay_lst.append(v)

    return render_template('main.tpl', outputfile=fpath, map_qstr=map_qstr,
        layer_qstr=layer_name, overlay_qstr=overlay_lst)


if __name__ == '__main__':
    # app.run(debug=True, port=80)
    app.run(port=80) 


