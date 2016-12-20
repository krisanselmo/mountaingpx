#!/usr/bin/env python
# -*- coding:utf-8 -*-

import os
from flask import Flask, request, redirect, url_for, flash, send_from_directory, render_template
from werkzeug.utils import secure_filename
from werkzeug import SharedDataMiddleware

import random
import osm_wpt

UPLOAD_FOLDER = 'uploads/'
ALLOWED_EXTENSIONS = set(['gpx'])



app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024

app.secret_key = 'A0Zr98j/3yX R~XHH!jmN]LWX/,?RT'


def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1] in ALLOWED_EXTENSIONS

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

            try:
                osm_wpt_on_gpx.osm_wpt('uploads/' + filename, plot_gpx=False, gpxoutputname='uploads/done/' + r + filename)
            except:
                flash('GPX Error')
                return redirect(request.url)

            return render_template('main.tpl', outputfile='uploads/done/' + r + filename )
        else:
            flash('Not allowed file type')
            return redirect(request.url)
    # return render_template('test.html')


    # osm_wpt_on_gpx.osm_wpt('uploads/test.gpx', plot_gpx=False, gpxoutputname='uploads/done/out2.gpx')
    return render_template('main.tpl', outputfile=None)
    # return render_template('leaflet.tpl', outputfile='uploads/done/route2046048-Grande_Sre.gpx')

    



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
    app.run(debug=True)    