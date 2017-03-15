<div class="jumbotron">
    <h1>Mountain GPX<sup> beta!</sup></h1>

    <p class="lead">Outil open source permettant d'ajouter automatiquement des points d'intérêts (POI) sur une trace GPX. La base de données source est issue du projet <a href="http://www.openstreetmap.org/" target="_blank">openstreetmap</a>.</p>
    <p><a class="btn btn-lg btn-danger" href="/map" role="button">Voir la carte</a></p>
</div>

<h3>Présentation</h3>
<p class="txt">À partir d'une trace gps (au format <a href="fr.wikipedia.org/wiki/GPX_(format_de_fichier)">GPX</a>) récupérée ou tracée par ailleurs, cet outil permet d'ajouter de manière automatique des points d'intérêts  issue d'openstreetmap dont la trace passe à proximité.</p> 
<img src="{{ url_for('static', filename='img/presentation/1.png') }}" class="img_644">
<div class='caption'>Exemple d'une trace GPS récupéré ne contenant que la route à suivre.</div>

<p class="txt">Une fois uploadé et passé à la moulinette, les points d'intérêts sont ajoutés dans un nouveau fichier GPX téléchargeable. Ce dernier est visualisable sur divers fonds de carte (exemple ci-dessous avec le rendu <a href="https://opentopomap.org" target="_blank">opentopomap</a>). La distance d'accrochage et le choix des types de POI sont personnalisables. Note: le temps de traitement peut être particulièrement long pour les gros fichiers.</p>
<img src="{{ url_for('static', filename='img/presentation/2.png') }}" class="img_644">
<div class='caption'>La trace GPS avec les POI une fois traité. Voir cette trace <a href="/track/1">ici</a>.</div>

<h3>Utilisation avec une montre GPS</h3>

<p class="txt">Si votre montre GPS supporte la navigation, une fois le fichier GPX transféré, votre itinéraire devrait s'afficher avec les POI associés comme ici:</p>
<img src="{{ url_for('static', filename='img/presentation/watch.jpg') }}" class="img_644">

<p class="txt">Testé sur Garmin Fēnix 3 et sur la plateforme Movescount.</p>

<h4>Garmin</h4>
<ul class="item">
    <li>Enregistrer le fichier GPX et le copier dans le dossier caché "<b>Garmin/NewFiles</b>" de la montre.</li>
</ul>

<h4>Suunto</h4>
<ul class="item">
    <li>Il suffit de télécharger puis d'importer le fichier GPX sur la plateforme <a href="http://www.movescount.com/map">Movescount</a>. Note: les différents <b>types</b> de POI ne sont pas reconnu par la plateforme, si vous voulez les avoir, il faudra les éditer manuellement :(</li>
</ul>

<h3>Exploration</h3>

<p class="txt">D'autres fonctionnalités sont disponibles en ajoutant diverses surcouches de carte avec par exemple les photos Flickr géolocalisées, les articles Wikipédia, les heatmaps Strava etc. À vous de les découvrir.</p>
<img src="{{ url_for('static', filename='img/presentation/3.png') }}" class="img_644">
<br>
<p class="txt">N'hésitez pas à m'envoyer votre retour d'utilisation directement dans les commentaires en-dessous, sur le GitHub du projet: <a href='https://github.com/krisanselmo/mountaingpx'>Mountaingpx <i class="fa fa-github"></i></a> ou encore par email à christophe.anselmo|at|gmail.com</p>

