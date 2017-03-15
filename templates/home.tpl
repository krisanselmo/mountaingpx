<html>

<head>
    <title>Mountain GPX</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Outil open source permettant d'ajouter automatiquement des points d'intérêts (POI) sur une trace GPX">
    <meta property="og:image" content="http://www.mountaingpx.fr/static/img/presentation/2.png">
    <meta property="og:description" content="Outil open source permettant d'ajouter automatiquement des points d'intérêts (POI) sur une trace GPX" />
    <link rel="shortcut icon" href={{ url_for('static', filename='favicon.ico') }}/>
    <link rel="stylesheet" href="//maxcdn.bootstrapcdn.com/font-awesome/4.5.0/css/font-awesome.min.css">
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css">
    <link rel='stylesheet' href="{{ url_for('static', filename='presentation.css') }}" type='text/css' />
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js"></script>
    <script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js"></script>


</head>

<body>
    <div class="container">
        <div class="header clearfix">
            <nav>
                <ul class="nav nav-pills pull-right">
                    <li class="nav active"><a href="#home" data-toggle="tab">Home</a></li>
                    <li class="nav"><a href="#about" data-toggle="tab">About</a></li>
                    <li class="nav"><a href="/map">Map</a></li>

                    <!-- <li role="presentation"><a href="https://github.com/krisanselmo/mountaingpx"><i class="fa fa-github fa-lg"></i></a></li> --
                    <!-- <li role="presentation"><a href="#">Contact</a></li> -->
                </ul>
            </nav>
            <h3 class="text-muted">Mountain GPX</h3>
        </div>


        <div class="tab-content">
            <div class="tab-pane fade in active" id="home">
                {% include "home_content.tpl" %}
                <hr>
                {% include "disqus_tab.tpl" %}
            </div>
            <div class="tab-pane fade" id="about">
                {% include "dependencies_tab.tpl" %}
            </div>
        </div>

        <footer class="footer">
            <p>&copy; 2017 Christophe Anselmo.</p>
        </footer>
    </div>

</body>
</html>