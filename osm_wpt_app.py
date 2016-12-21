#!/usr/bin/env python
# -*- coding:utf-8 -*-

import os
from flask import Flask, request, redirect, url_for, flash, send_from_directory, render_template, abort
from werkzeug.utils import secure_filename
from werkzeug import SharedDataMiddleware

import random
import osm_wpt

UPLOAD_FOLDER = 'uploads/'
OUTPUT_FOLDER = 'uploads/done/'
ALLOWED_EXTENSIONS = set(['gpx'])



app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024

app.secret_key = 'A0Zr98j/3yX R~XHH!jmN]LWX/,?RT'


def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1] in ALLOWED_EXTENSIONS


# @app.errorhandler(401)
# @app.errorhandler(404)
# @app.errorhandler(500)
# def error_page(error):
#     return "D'Oh! Error {}".format(error.code), error.code



@app.route('/', methods=['GET', 'POST'])
def main_page():
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
            filename = secure_filename(file.filename)
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
            # return redirect(url_for('uploaded_file',
                                    # filename=filename))
           

            # IL FAUDRA FAIRE UNE REDIRECTION ICI

            print('---- > Launch script')
            r = str(random.randint(1,10**2))


            out_filename = str(len(os.listdir(OUTPUT_FOLDER)) + 1) 
            print(out_filename)
            fpath = OUTPUT_FOLDER + out_filename + '.gpx'


            try:
                osm_wpt.osm_wpt('uploads/' + filename, plot_gpx=False, lim_dist=0.05, gpxoutputname=fpath )
            except Exception as err:
                flash('GPX Error')
                # flash(err)
                return redirect(request.url)

            # return render_template('main.tpl', outputfile=OUTPUT_FOLDER + out_filename )
            # return redirect(url_for('main_page', out_filename=out_filename))
            # return render_template('main.tpl', outputfile=OUTPUT_FOLDER + out_filename + '.gpx')
            # return redirect(url_for('track_page', out_filename=out_filename))
            
            print(os.path.isfile(fpath))
            return render_template('main.tpl', outputfile=fpath)
            

            
        else:
            flash('Not allowed file type')
            return redirect(request.url)
    # return render_template('test.html')


    # osm_wpt_on_gpx.osm_wpt('uploads/test.gpx', plot_gpx=False, gpxoutputname='uploads/done/out2.gpx')
    return render_template('main.tpl', outputfile=None)
    # return render_template('leaflet.tpl', outputfile='uploads/done/route2046048-Grande_Sre.gpx')





@app.route('/track/<out_filename>', methods=['GET', 'POST'])
def track_page(out_filename):

    fpath = OUTPUT_FOLDER + out_filename + '.gpx'
    

    if not os.path.isfile(fpath):
        print(os.getcwd())
        print('File not found ' + fpath)
        abort(404)


    return render_template('main.tpl', outputfile=fpath)


    # app.add_url_rule('/uploads/<filename>', 'uploaded_file',
    #                  build_only=True)
    # app.wsgi_app = SharedDataMiddleware(app.wsgi_app, {
    #     '/uploads':  app.config['UPLOAD_FOLDER']
    # })


@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'],
                               filename)

app.add_url_rule('/uploads/<filename>', 'uploaded_file',
                 build_only=True)
app.wsgi_app = SharedDataMiddleware(app.wsgi_app, {
    '/uploads':  app.config['UPLOAD_FOLDER']
})


if __name__ == '__main__':

    if not os.path.exists(OUTPUT_FOLDER):
        os.makedirs(OUTPUT_FOLDER)

    app.run(debug=True)    