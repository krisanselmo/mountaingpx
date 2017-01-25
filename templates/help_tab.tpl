<h2>Aperçu</h2>

Un simple envoie vers le serveur d'un fichier GPX permet de faire apparaître certains points d’intérêt (POI) sur cette même trace. Ces POI proviennent de la base de données <a href="http://www.openstreetmap.org/">Openstreetmap</a> et peuvent être enrichie à tout moment par n'importe qui.

<h3>Exemple</h3>

<!-- <img src="{{ url_for('static', filename='img/tab/garmin-fenix-3-navigation.jpg') }}" width=220px align="middle"> -->
<!-- <img src="{{ url_for('static', filename='img/help_intro/Suunto-navigation.jpg') }}" width=250px align="middle"> -->

<h2>Utilisation</h2>
Il suffit de cliquer sur le boutton suivant:
<br> <img src="{{ url_for('static', filename='img/tab/button.png') }}">
<br>... puis d'importer votre fichier GPX et d'attendre la réponse du serveur. Le nouveau GPX devrait s'afficher tout seul.
<br>Il est aussi possible d'utiliser le glisser/déposer directement dans la page. 

<h2>Exemples d'utilisation</h2>
<h3>1) Vérifier la qualité d'une trace</h3>

à tout moment le signal GPS peut décrocher 
En navigation en montagne, il vaut mieux ne pas suivre bêtement la trace sur sa montre...  
Strava

<h2>Export the GPX </h2>

<h3>Garmin</h3>
<p>Save the GPX file to your computer.
<br>Plug your device in to your computer. Once connected, it is recognized as a USB drive.
<br>Open the "Garmin" folder in that drive.
<br>Find the folder labeled, "NewFiles". Move your downloaded GPX file there.
<br>Once the file has transferred, you can disconnect your Garmin.
<br>Now turn on your Garmin device. The route should be available in Courses on the device.
<br>For others watches or more details on the file transfert, I recommand to read <a href="http://www.scarletfire.co.uk/transfer-gpx-file-to-garmin/">this</a>.
</p>
<h3>Suunto</h3>
For Suunto users the outputed gpx can be imported on movescount map. Note that unfortunately the waypoint types are not recognized by movescount.

<h2>Bugs / Questions / Contributions</h2>
Contactez-moi: christophe.anselmo@gmail.com
<br>Le GitHub: <a href='https://github.com/krisanselmo/osm_wpt'>OSM_wpt</a>