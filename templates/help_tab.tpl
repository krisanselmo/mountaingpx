<!-- <h2>Aperçu</h2> -->

<!-- Un simple envoie vers le serveur d'un fichier GPX permet de faire apparaître certains points d’intérêt (POI) sur cette même trace. Ces POI proviennent de la base de données <a href="http://www.openstreetmap.org/">Openstreetmap</a> et peuvent être enrichie à tout moment par n'importe qui. -->

<!-- <h3>Exemple</h3> -->

<!-- <img src="{{ url_for('static', filename='img/tab/garmin-fenix-3-navigation.jpg') }}" width=220px align="middle"> -->
<!-- <img src="{{ url_for('static', filename='img/help_intro/Suunto-navigation.jpg') }}" width=250px align="middle"> -->

<!-- <h2>Utilisation</h2>
Il suffit de glisser/déposer un fichier GPX dans la fenêtre ou de cliquer sur le bouton suivant:

<br>
<br>
<div class="input-file-container">  
    <input class="input-file" id="gpx-file" type="file" accept=".gpx" name=file>
    <label class="input-file-trigger">Envoyer un fichier GPX</label>
</div>

<p>Après traitement le nouveau GPX devrait s'afficher tout seul et être dispo
</p>
 -->


<h2>Données sources</h2>
<p> Les points d'intérêt (POI) proviennent de la base de données du projet <a href="http://www.openstreetmap.org/">Openstreetmap</a> (OSM). Chacun est libre d'y contribuer et je vous encourage vivement à le faire après chacune de vos sorties. Un guide du débutant est disponible sur le <a href="http://wiki.openstreetmap.org/wiki/FR:Guide_du_d%C3%A9butant">wiki</a> du projet.</p>

<h2>Légende</h2>
<h3>Hiking trail difficulty</h3>
Classification de difficulté des chemins de randonnée (<a href="http://wiki.openstreetmap.org/wiki/FR:Key:sac_scale" role="tab" target="_blank">Wiki</a>). S'affiche à partir du zoom 13. Plus d'infos sont disponibles en cliquant sur les chemins.

<ul role="tablist">
    <div id='trail_scale'>T1 <div id='T1'></div></div>
    <div id='trail_scale'>T2 <div id='T2'></div></div>
    <div id='trail_scale'>T3 <div id='T3'></div></div>
    <div id='trail_scale'>T4 <div id='T4'></div></div>
    <div id='trail_scale'>T5 <div id='T5'></div></div>
    <div id='trail_scale'>T6 <div id='T6'></div></div>
</ul>

<h2>Exploiter le GPX avec sa montre</h2>

<h3>Garmin</h3>
<p>Save the GPX file to your computer.
Plug your device in to your computer. Once connected, it is recognized as a USB drive.
Open the "Garmin" folder in that drive.
Find the folder labeled, "NewFiles". Move your downloaded GPX file there.
Once the file has transferred, you can disconnect your Garmin.
Now turn on your Garmin device. The route should be available in Courses on the device.
For others watches or more details on the file transfert, I recommand to read <a href="http://www.scarletfire.co.uk/transfer-gpx-file-to-garmin/">this</a>.
</p>
<h3>Suunto</h3>
<p>For Suunto users the outputed gpx can be imported on movescount map. Note that unfortunately the waypoint types are not recognized by movescount.</p>
<!-- <p><font color='red'>Update</font>: it's no longer working, waypoints are not saved :(</p> -->

<h2>Bugs / Questions / Contributions</h2>
Contactez-moi: christophe.anselmo[at]gmail.com
<br>Le GitHub <i class="fa fa-github"></i>: <a href='https://github.com/krisanselmo/mountaingpx'>mountaingpx</a>