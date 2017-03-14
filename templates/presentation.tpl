<html>

<head>
    <title>Mountain GPX</title>
    <meta charset="utf-8" />
    <!-- <meta name="viewport" content="width=device-width, initial-scale=1.0"> -->
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Outil permettant d'ajouter automatiquement des points d'intérêts (POI) sur une trace GPX">
    <meta property="og:image" content="http://www.mountaingpx.fr/static/img/presentation/2.png">
    <meta property="og:description" content="Outil permettant d'ajouter automatiquement des points d'intérêts (POI) sur une trace GPX" />
    <!-- <meta name="author" content=""> -->
    {# -- CSS -- #}
    <link rel="shortcut icon" href={{ url_for( 'static', filename='favicon.ico' ) }}/>
    <!-- <link rel='stylesheet' href="{{ url_for('static', filename='cssapp2.css') }}" type='text/css'/> -->
    <link rel="stylesheet" href="//maxcdn.bootstrapcdn.com/font-awesome/4.5.0/css/font-awesome.min.css">

    <!-- Latest compiled and minified CSS -->
  <!--   <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css" integrity="sha384-BVYiiSIFeK1dGmJRAkycuHAHRg32OmUcww7on3RYdg4Va+PmSTsz/K68vbdEjh4u" crossorigin="anonymous"> -->
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css">


    <link rel='stylesheet' href="{{ url_for('static', filename='presentation.css') }}" type='text/css' />



</head>

<body>


    <div class="container">
        <div class="header clearfix">
            <nav>
                <ul class="nav nav-pills pull-right">
                    <li role="presentation" class="active"><a href="#">Home</a></li>
                    <li role="presentation"><a href="/map">Map</a></li>
                    <!-- <li role="presentation"><a href="https://github.com/krisanselmo/mountaingpx"><i class="fa fa-github fa-lg"></i></a></li> -->


                    <!-- <li role="presentation"><a href="#">Contact</a></li> -->
                </ul>
            </nav>
            <h3 class="text-muted">Mountain GPX</h3>
        </div>

        <div class="jumbotron">
            <h1>Mountain GPX<sup> beta!</sup></h1>
            <p class="lead">Outil permettant d'ajouter automatiquement des points d'intérêts (POI) sur une trace GPX. La base de données source est issue du projet <a href="http://www.openstreetmap.org/" target="_blank">openstreetmap</a>.</p>
            <p><a class="btn btn-lg btn-danger" href="/map" role="button">Voir la carte</a></p>
        </div>

        <h3>Présentation</h3>
        <p class="txt">À partir d'une trace gps (au format <a href="fr.wikipedia.org/wiki/GPX_(format_de_fichier)">GPX</a>) récupérée ou tracée par ailleurs, cet outil permet d'ajouter de manière automatique des points d'intérets issue d'openstreetmap dont la trace passe à proximité.</p> 
        <img src="{{ url_for('static', filename='img/presentation/1.png') }}" class="img_644">
        <div class='caption'>Fig. 1 - Exemple d'une trace GPS récupéré ne contenant que la route à suivre.</div>

        <p class="txt">Une fois téléchargé et passé à la moulinette, les points d'intérets sont ajoutés directement dans un nouveau fichier GPX. Ce dernier est visualisable sur divers fonds de carte (exemple Fig. 2 avec le rendu <a href="https://opentopomap.org" target="_blank">opentopomap</a>). La distance d'accrochage et le choix des types de POI est customisable. Note: le temps de traitement peut être particulièrement long pour les gros fichiers.</p>
        <img src="{{ url_for('static', filename='img/presentation/2.png') }}" class="img_644">
        <div class='caption'>Fig. 2 - La trace GPS avec les POI une fois traité.  Voir cette trace <a href="/track/1">ici</a>.</div>



        <h3>Utilisation avec sa montre GPS</h3>

        <p class="txt">En suivant votre itinéraire avec une montre GPS ou un smartphone, les POI seront directement affichés pendant la navigation (si votre appareil le supporte).</p>
        <img src="{{ url_for('static', filename='img/presentation/watch.jpg') }}" class="img_644">

        <h3>Exploration</h3>

        <p class="txt"> D'autres fonctionnalités sont disponibles en ajoutant diverses sur-couches de carte avec par exemple les photos Flickr, les articles wikipédia, les heatmaps Strava etc. À vous de découvrir.</p>
        <img src="{{ url_for('static', filename='img/presentation/3.png') }}" class="img_644">

        <p>N'hésitez pas à m'envoyer votre retour d'utilisation à christophe.anselmo|at|gmail.com ou les bugs sur le GitHub <i class="fa fa-github"></i> du projet: <a href='https://github.com/krisanselmo/mountaingpx'>mountaingpx</a></p>

        <footer class="footer">
            <p>&copy; 2017 Christophe Anselmo.</p>
        </footer>

    </div>
    <!-- /container -->




</body>

</html>