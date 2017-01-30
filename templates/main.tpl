{# http://jinja.pocoo.org/docs/dev/templates/ #}
<!DOCTYPE html>
<html>
<head>
    <title>Mountain GPX</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    {# -- CSS -- #}
    <link rel="shortcut icon" href={{ url_for('static', filename='favicon.ico') }}/>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.0.2/dist/leaflet.css" />
    <link rel="stylesheet" href="//maxcdn.bootstrapcdn.com/font-awesome/4.5.0/css/font-awesome.min.css">    
    <link rel="stylesheet" href="https://domoritz.github.io/leaflet-locatecontrol/dist/L.Control.Locate.min.css" />    
    <link rel='stylesheet' href="{{ url_for('static', filename='leaflet.elevation-0.0.4_kris.css') }}" type='text/css'/>
    <link rel='stylesheet' href="{{ url_for('static', filename='cssapp2.css') }}" type='text/css'/>
    <link rel="stylesheet" href="{{ url_for('static', filename='leaflet-sidebar.css') }}" type='text/css'/> 
    <link rel='stylesheet' href="{{ url_for('static', filename='OverPassLayer.css') }}" type='text/css'/>
    {# -- JAVASCRIPT -- #}
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js"></script>
    <script src="{{ url_for('static', filename='js.cookie.js') }}"></script>
    <script src="https://unpkg.com/leaflet@1.0.2/dist/leaflet.js"></script>
    <script src="http://d3js.org/d3.v3.min.js" charset="utf-8"></script> {# For Elevation #}
    <script src="https://domoritz.github.io/leaflet-locatecontrol/dist/L.Control.Locate.min.js" charset="utf-8"></script> {# https://github.com/domoritz/leaflet-locatecontrol #}
    <script src="{{ url_for('static', filename='gpx.js') }}"></script>
    <script src="{{ url_for('static', filename='Flickr.js') }}"></script> {# https://github.com/shurshur/Leaflet.Flickr #}
    <script src="{{ url_for('static', filename='leaflet.elevation-0.0.4.src.js') }}"> </script>
    <script src="{{ url_for('static', filename='jsonp.min.js') }}"> </script> {#wiki dependency#}
    <script src="{{ url_for('static', filename='leaflet-wikipedia.js') }}"> </script> {#https://github.com/MatthewBarker/leaflet-wikipedia#}
    <script src="{{ url_for('static', filename='OverPassLayer.js') }}"></script>
    <script src="{{ url_for('static', filename='leaflet-sidebar.js') }}"></script>
    <!-- <script src="{{ url_for('static', filename='jquery.jsonify-0.3.1.min.js') }}"></script> -->
    <script src="{{ url_for('static', filename='jquery.jsonify-0.3.1.js') }}"></script> {#https://github.com/kushalpandya/JSONify#}

    {# Other 
    <!-- <link rel="stylesheet" href="{{ url_for('static', filename='leaflet-openweathermap.css') }}" type='text/css'/>  -->    
    <!-- <script src='//api.tiles.mapbox.com/mapbox.js/plugins/leaflet-omnivore/v0.3.1/leaflet-omnivore.min.js'></script>  -->
    <!-- <script src="{{ url_for('static', filename='map.js') }}"></script> -->
    <!-- <script src='//api.tiles.mapbox.com/mapbox.js/plugins/leaflet-omnivore/v0.3.1/leaflet-omnivore.min.js'></script> -->
    <!--<script src='https://api.mapbox.com/mapbox.js/plugins/leaflet-omnivore/v0.2.0/leaflet-omnivore.min.js'></script>  -->
    <!-- <script src="https://rawgithub.com/mpetazzoni/leaflet-gpx/master/gpx.js"></script> -->
    <!-- <script src="{{ url_for('static', filename='leaflet-wikipedia.js') }}"></script> -->
    <!-- <script src="{{ url_for('static', filename='Leaflet.EditInOSM.js') }}"></script>  https://github.com/yohanboniface/Leaflet.EditInOSM  -->
    <!-- <script src="{{ url_for('static', filename='bootbox.min.js') }}"></script> -->
    <!-- <script src="{{ url_for('static', filename='leaflet-openweathermap.js') }}"></script> https://github.com/buche/leaflet-openweathermap  -->
    <!-- <script src="{{ url_for('static', filename='formToObject.min.js') }}"></script> https://raw.githubusercontent.com/serbanghita/formToObject.js/master/dist/formToObject.min.js -->
    #}


</head>
<body>
<div style="visibility:hidden; opacity:0" id="dropzone"></div>

 <div id="sidebar" class="sidebar collapsed">
        <!-- Nav tabs -->
        <div class="sidebar-tabs">
            <ul role="tablist">
                <li><a href="#home" role="tab"><i class="fa fa-bars"></i></a></li>
                <li><a href="#settings" role="tab"><i class="fa fa-gear"></i></a></li>
                <li><a href="#help" role="tab"><i class="fa fa-question-circle"></i></a></li> 
                <li><a href="#links" role="tab"><i class="fa fa-external-link"></i></a></li> 
            </ul>
            <ul role="tablist">
                <li><a href="#disqus" role="tab"><i class="fa fa-comment"></i></a></li> 
                <li><a href="#dependencies" role="tab"><i class="fa fa-code"></i></a></li> 
                <li><a href="https://github.com/krisanselmo/osm_wpt" role="tab" target="_blank"><i class="fa fa-github"></i></a></li>
            </ul>
        </div>

        <!-- Tab panes -->
        <div class="sidebar-content">
            <div class="sidebar-pane" id="home">
                <h1 class="sidebar-header">Mountain GPX<span class="sidebar-close"><i class="fa fa-caret-left"></i></span></h1>

                <!-- <p>Automatically add waypoints on your GPX from <a href="http://www.openstreetmap.org/" target="_blank">OSM</a> database</p> -->
                <p>Ajoute automatiquement des points d'intérêts (POI) depuis la base de données <a href="http://www.openstreetmap.org/" target="_blank">openstreetmap</a> sur une trace GPX.</p> 

                <br>
                <form action="?" method=post enctype=multipart/form-data id="form_id">
                    <div class="input-file-container">  
                        <input class="input-file" id="gpx-file" type="file" accept=".gpx" name=file>
                        <label class="input-file-trigger">Envoyer un fichier GPX<!-- select a GPX file... --><!--  <i class="fa fa-upload"></i> --></label>
                    </div><br>
                    <div id="up_filename"></div>
                </form>

                <div class="msg_flsh">  
                {% with messages = get_flashed_messages() %}
                {% if messages %}
                {{ messages[0] }}  {# Pas sur de la notation ici  #}
                {% endif %}
                {% endwith %}
                </div>

                {% if outputfile is not none %}
                <hr>
                <h3><div class="gpx-name" title="test"></div></h3>

                <div class="download"><a href='../{{outputfile}}'>Télécharger <i class="fa fa-download"></i></a></div></li>

                <h3>Infos</h3>
                <div class="info_tab">
                    <table>
                        <tr><td>Distance:</td>
                            <td><span title="Distance 2d" class="gpx-info-dist"> </span> km</td></tr>
                        <tr><td>Elevation:</td>
                            <td><span title="Raw elevation data" class="gpx-info-egain"> </span> m</td></tr>
                        <tr><td>Waypoints:</td>
                            <td><span class="gpx-info-wpt_number"> </span></td></tr>
                    </table>
                </div>

                <h3>Elevation</h3>
                <div class="elevation steelblue-theme leaflet-control">
                    <div id="elevation-div"></div>
                </div>

                <!-- <h3>Liste des POI</h3> -->
                {% endif %}

            </div>


            <div class="sidebar-pane" id="help">
                <h1 class="sidebar-header">Aide<span class="sidebar-close"><i class="fa fa-caret-left"></i></span></h1>
                {% include "help_tab.tpl" %}
            </div>

            <div class="sidebar-pane" id="settings">
                <h1 class="sidebar-header">Paramètres<span class="sidebar-close"><i class="fa fa-caret-left"></i></span></h1>
                {% include "settings_tab.tpl" %}
            </div>

            <div class="sidebar-pane" id="links">
                <h1 class="sidebar-header">Liens externes<span class="sidebar-close"><i class="fa fa-caret-left"></i></span></h1>
                {% include "links_tab.tpl" %}
            </div>

            <div class="sidebar-pane" id="dependencies">
                <h1 class="sidebar-header">Outils utilisés<span class="sidebar-close"><i class="fa fa-caret-left"></i></span></h1>
                {% include "dependencies_tab.tpl" %}
            </div>

            <!-- <div class="sidebar-pane" id="disqus">
                <h1 class="sidebar-header">Commentaires<span class="sidebar-close"><i class="fa fa-caret-left"></i></span></h1>
                {% include "disqus_tab.tpl" %}
            </div> -->

        </div>
    </div>



    
<script>

    // document.cookie = "username=John Doe";

    // Check for the various File API support.
    if (window.File && window.FileReader && window.FileList && window.Blob) {
      // Great success! All the File APIs are supported.
    } 
    else {
      alert('The File APIs are not fully supported in this browser.');
    }

    {# -------------------- #}
    {#        BUTTON        #}
    {# -------------------- #}
    
    document.querySelector("html").classList.add('js');

    var fileInput  = document.querySelector( ".input-file" ),  
        button     = document.querySelector( ".input-file-trigger" ),
        the_return = document.querySelector(".file-return");
          
    button.addEventListener( "keydown", function( event ) {  
        if ( event.keyCode == 13 || event.keyCode == 32 ) {  
            fileInput.focus();  
        }  
    });
    button.addEventListener( "click", function( event ) {
       fileInput.focus();
       return false;
    });  
    fileInput.addEventListener( "change", function( event ) {  
        // $("#up_filename").html(this.files[0].name);
        $('#form_id').submit();
    });  


    {# -------------------- #}
    {#      DROP ZONE       #}
    {# -------------------- #}

    var lastTarget = null;

    function isFile(evt) {
        var dt = evt.dataTransfer;

        for (var i = 0; i < dt.types.length; i++) {
            if (dt.types[i] === "Files") {
                return true;
            }
        }
        return false;
    }

    window.addEventListener("dragenter", function (e) {
        if (isFile(e)) {
            lastTarget = e.target;
            document.querySelector("#dropzone").style.visibility = "";
            document.querySelector("#dropzone").style.opacity = 1;
        }
    });

    window.addEventListener("dragleave", function (e) {
        e.preventDefault();
        if (e.target === lastTarget) {
            document.querySelector("#dropzone").style.visibility = "hidden";
            document.querySelector("#dropzone").style.opacity = 0;
        }
    });

    window.addEventListener("dragover", function (e) {
        e.preventDefault();
    });

    window.addEventListener("drop", function (e) {
        e.preventDefault();
        document.querySelector("#dropzone").style.visibility = "hidden";
        document.querySelector("#dropzone").style.opacity = 0;
        // document.querySelector("#textnode").style.fontSize = "42px";
        if(e.dataTransfer.files.length == 1)
        {
            $("#up_filename").html(e.dataTransfer.files[0].name);
            e.dataTransfer.getData('text/html')

            var formData = new FormData();
            formData.append('file', e.dataTransfer.files[0]);

            // now post a new XHR request
            var xhr = new XMLHttpRequest();
            xhr.onload = function () {
                if (xhr.readyState === xhr.DONE) {
                    if (xhr.status === 200) {
                        window.location.replace(xhr.responseURL);    
                    }
                }
            };
            xhr.open('POST', '?', false);
            xhr.send(formData);
        }
        else{
            $(".msg_flsh").html("Only one file allowed");
        }
    });



</script>

<div id='map'></div>

<script>
    
    {# -------------------- #}
    {#    LEAFLET LAYERS    #}
    {# -------------------- #}

    var osmAttr = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
            'Imagery &copy <a href="https://opentopomap.org">OpenTopoMap</a>',
        osmUrl = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    var opentopoAttr = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
            'Imagery &copy <a href="https://opentopomap.org">OpenTopoMap</a>',
        opentopoUrl = 'http://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        opentopo = L.tileLayer(opentopoUrl, {
            attribution: opentopoAttr,
            maxZoom:17,
            errorTileUrl: osmUrl
        });
    
    var osm = L.tileLayer(osmUrl, {
            attribution: osmAttr
        });
        osmcyclemap = L.tileLayer('http://{s}.tile.opencyclemap.org/cycle/{z}/{x}/{y}.png', {
            attribution: osmAttr
        });
        osmfr = L.tileLayer('http://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
            attribution: osmAttr
        });

    var mapboxAttr = 'Map data &copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors, ' +
            'Imagery &copy <a href="https://mapbox.com">Mapbox</a>',
        mapboxUrl = 'https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpandmbXliNDBjZWd2M2x6bDk3c2ZtOTkifQ._QA7i5Mpkd_m30IGElHziw';            
    var streets  = L.tileLayer(mapboxUrl, {
            id: 'mapbox.streets', 
            attribution: mapboxAttr
        });

    var grayscale = L.tileLayer(mapboxUrl, {
            id: 'mapbox.light', 
            attribution: mapboxAttr
        });

    var outdoors = L.tileLayer(mapboxUrl, {
            id: 'mapbox.outdoors',
            attribution: mapboxAttr
        });

    var satellite = L.tileLayer(mapboxUrl, {
            id: 'mapbox.satellite', 
            attribution: mapboxAttr
        });

    var googleUrl = 'https://mts{s}.google.com/vt/lyrs=s@186112443&hl=x-local&src=app&x={x}&y={y}&z={z}&s=Galile',
        googleAttr = '&copy; Google Maps',
        google = L.tileLayer(googleUrl, {
            subdomains: '0123',
            attribution: googleAttr,
            zIndex: 4
        });

    var mapyCzUrl = "https://m{s}.mapserver.mapy.cz/wturist-m/{z}-{x}-{y}",
        mapyCzAttr = '&copy; <a href="https://www.seznam.cz/" target="_blank">Seznam.cz, a.s</a>',
        mapyCz = L.tileLayer(mapyCzUrl, {
            subdomains: '1234',
            attribution: mapyCzAttr
        });
            
    // OVERLAY

    var stravaUrl = 'https:globalheat.strava.com/tiles/{id}/color{color}/{z}/{x}/{y}.png',
        strvAttr = '<a href="https://www.strava.com/">Strava</a>',
        strava_overlay_b = L.tileLayer(stravaUrl, {
            zIndex: 2, 
            id: 'running', 
            color: '3', 
            attribution: strvAttr
        }),
        strava_overlay_r = L.tileLayer(stravaUrl, {
            zIndex: 2, 
            id: 'running', 
            color: '1', 
            attribution: strvAttr
        }),
        strava_bike_overlay = L.tileLayer(stravaUrl, {
            zIndex: 2, 
            id: 'cycling', 
            color: '3', 
            attribution: strvAttr
        });
        
    var lonviaUrl = 'http://tile.lonvia.de/{id}/{z}/{x}/{y}.png',
        lonviaAttr = '<a href="http://hiking.waymarkedtrails.org/">waymarkedtrails</a>',
        lonvia_overlay = L.tileLayer(lonviaUrl, {
            zIndex: 2, 
            id: 'hiking',
            // id: 'cycling',
            attribution: 
            lonviaAttr
        });

    var mapyCz_overlay = L.tileLayer("https://m{s}.mapserver.mapy.cz/hybrid-trail_bike-m/{z}-{x}-{y}", {
            zIndex: 1, 
            subdomains: '1234',
            attribution: '',
        });

    var hillshade_overlay = L.tileLayer("http://c.tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png", {
            zIndex: 10, 
            opacity: 0.75, 
            minZoom:12,
            attribution: '<a href="http://nasa.gov/">NASA SRTM</a>',
        });
        
    // var clouds = L.OWM.clouds({showLegend: true, opacity: 0.5});
    // var temp = L.OWM.temperature({showLegend: true, legendPosition: 'bottomleft', opacity: 0.5});
    // var temp = L.OWM.current();

    var wiki = L.layerGroup.wikipediaLayer({
            target: '_blank',
            images:"{{ url_for('static', filename='img/') }}",
            minZoom: 10,
            popupOnMouseover: true,
            url: 'https://fr.wikipedia.org/',
        });

    var flickr = new L.Flickr('a06f677e097235ad98d9f0961d44252c',{maxLoad: 25, maxTotal: 250});      

    var ParkingIcon = L.icon({
                            iconUrl: "{{ url_for('static', filename='img/markers/Parking_icon.svg') }}",
                            iconSize:     [15, 15], // size of the icon
                            popupAnchor:  [0, -15] // point from which the popup should open relative to the iconAnchor
                        });

    var overpass_parking = new L.OverPassLayer({
            endpoint: "http://api.openstreetmap.fr/oapi/",
            query: "node(BBOX)['amenity'='parking'];out;",
            minzoom: 11,

            callback: function(data) {
                for(var i=0;i<data.elements.length;i++) {
                    var e = data.elements[i];
                    if (e.id in this.instance._ids) return;
                        this.instance._ids[e.id] = true;
                        var pos = new L.LatLng(e.lat, e.lon);
                        var popup = this.instance._poiInfo(e.tags,e.id);
                        var Picon = L.marker(pos, {icon: ParkingIcon})
                        .bindPopup(popup);
                        this.instance.addLayer(Picon);
                }
            },
            minZoomIndicatorOptions: {
                minZoomMessage: ""
            }
        });

    var GuidepostIcon = L.icon({
                            iconUrl: "{{ url_for('static', filename='img/mapy_cz/384.png') }}",
                            iconSize:     [20, 20], // size of the icon
                            popupAnchor:  [0, -20] // point from which the popup should open relative to the iconAnchor
                    });

    var overpass_guidepost = new L.OverPassLayer({
            endpoint: "http://api.openstreetmap.fr/oapi/",
            query: "node(BBOX)['information'='guidepost'];out;",
            minzoom: 13,

            callback: function(data) {
                for(var i=0;i<data.elements.length;i++) {
                    var e = data.elements[i];
                    if (e.id in this.instance._ids) return;
                        this.instance._ids[e.id] = true;
                        var pos = new L.LatLng(e.lat, e.lon);
                        // console.log(e.tags)
                        var popup = this.instance._poiInfo(e.tags,e.id);
                        var Picon = L.marker(pos, {icon: GuidepostIcon})
                        .bindPopup(popup);
                        this.instance.addLayer(Picon);
                }
            },
            minZoomIndicatorOptions: {
                minZoomMessage: ""
            }
        });


    // overpass_guidepost.on('mouseover', function(e) {
    //   //open popup;
    //   var popup = L.popup()
    //    .setLatLng(e.latlng) 
    //    .setContent('Popup')
    //    .openOn(map);
    // });

    // overpass_guidepost.on('mouseover', function(e){
    //     overpass_guidepost.openPopup(map);
    // });

        // overpass_guidepost.bindPopup("Popup content");
        // overpass_guidepost.on('mouseover', function (e) {
        //     this.openPopup();
        // });
        // overpass_guidepost.on('mouseout', function (e) {
        //     this.closePopup();
        // });
// http://gis.stackexchange.com/questions/31951/how-to-show-a-popup-on-mouse-over-not-on-click

    // function addDataToMap(data, map) {
        // var dataA = $.getJSON("{{ url_for('static', filename='massifs_et_travers_es.geojson') }}");
        // var dataLayer = L.geoJson(dataA, {
        //     onEachFeature: function(feature, layer) {
        //         var popupText = "" + feature.properties.name
        //             // + "<br>" + "<a href='" + feature.properties.description.replace('[[','').replace(']]','') 
        //             + "<br>" + "<a href='" + String(feature.properties.description).replace('[[','').replace(']]','') 
        //             + "'>Wikipedia</a>";
        //             // + "<br><a href='" + feature.properties.url + "'>More info</a>";
        //         layer.bindPopup(popupText); }
        //     });
        // // dataLayer.addTo(map);
    // }
    

    // $.getJSON("{{ url_for('static', filename='massifs_et_travers_es.geojson') }}", function(data) { addDataToMap(data, map); });


    {# -------------------- #}
    {#    CHECKED LAYERS    #}
    {# -------------------- #}

    {% if layer_qstr is none %}
        map_layers = [opentopo]; // default value
    {% else %}
        map_layers = [{{layer_qstr}}];
    {% endif %}

    {% if overlay_qstr is defined %}
        {% for item in overlay_qstr %}
            map_layers.push({{item}});
        {% endfor %}
    {% endif %}


    var map = new L.map('map', {
        zoom: 12,
        worldCopyJump: true,
        zoomControl: false,
        layers: map_layers
    });
    
    L.control.zoom({
        position:'topright'
    }).addTo(map);

    {# -------------------- #}
    {# OVERPASS WAYS LAYER  #}
    {# -------------------- #}

    var nodes = {}, ways = {};
    $(function () {
        // map = POImap.init();
        layer_trail_sac = new L.GeoJSON(null, {
            onEachFeature: function (e, layer_trail_sac) {
                if (e.properties && e.properties.name) layer_trail_sac.bindPopup(e.properties.name);
                if (e.properties && e.properties.style) layer_trail_sac.setStyle(e.properties.style);
            }
        });
        layerControl.addOverlay(layer_trail_sac, 'Hiking trail difficulty');
        loadPoi();
        map.on('moveend', loadPoi);
    });

    var addedStopLabels = {};
    function loadPoi() {
        if (map.getZoom() < 13) {
            return;
        }

        var tagsTable = function(tags, type, id) {
            var r = $('<table>');
            if (type && id)
                r.append($('<tr>').append($('<th>').text('ID')).append($('<td>').text(id).append(' ').append($('<a>').attr({href: '//www.openstreetmap.org/browse/'+{w:'way',n:'node',r:'relation'}[type]+'/'+id, target: '_blank'}).text('browse'))));
                // r.append($('<tr>').append($('<th>').text('ID')).append($('<td>').text(id).append(' ').append($('<a>').attr({href: 'href="//localhost:8111/load_object?objects='+type+id, target: '_blank'}).text('edit')).append(' ').append($('<a>').attr({href: '//www.openstreetmap.org/browse/'+{w:'way',n:'node',r:'relation'}[type]+'/'+id, target: '_blank'}).text('browse'))));
            for (var key in tags)
                r.append($('<tr>').append($('<th>').text(key)).append($('<td>').text(tags[key])));
            return $('<div>').append(r).html();
        };

      var handleNode = function (n) {
      };

      var handleWay = function (w) {
        if (ways[w.id] || !w.tags.sac_scale) return;
        ways[w.id] = true;
        var style = {};
        // style.color = 'yellow'
        // COLOR : http://www.color-hex.com/color/00007f
        style.opacity = 0.8;
        style.color = -1 != $.inArray(w.tags.sac_scale, ['hiking','mountain_hiking',
          'demanding_mountain_hiking','alpine_hiking','demanding_alpine_hiking','difficult_alpine_hiking']) ? (!w.tags.sac_scale
          ? 'black'
          : w.tags.sac_scale == 'hiking'
          ? 'yellow'
          : w.tags.sac_scale == 'mountain_hiking'
          ? 'blue'
          : w.tags.sac_scale == 'demanding_mountain_hiking'
          ? '#00007f'
          : w.tags.sac_scale == 'alpine_hiking'
          ? 'red'
          : w.tags.sac_scale == 'demanding_alpine_hiking'
          ? '#990000'
          : w.tags.sac_scale == 'difficult_alpine_hiking'
          ? '#4C0000'
          : '#d00')
        : '#20000000';
        if (w.tags.sac_scale == 'demanding_alpine_hiking' || w.tags.sac_scale == 'demanding_mountain_hiking' )
        style.svg = {'stroke-dasharray': '6,8'};
        style.weight = 3;
        // console.log(style);
        layer_trail_sac.addData({
          type: 'Feature',
          geometry: w.geometry,
          properties: {name: tagsTable(w.tags, 'w', w.id), style: style}
        });
      };

      POImap.loadAndParseOverpassJSON(
          '//api.openstreetmap.fr/oapi/interpreter?data=[out:json];(way["highway"="path"]["sac_scale"](BBOX);node(w));out;',
          handleNode, handleWay, null);

    }

    var POImap = {};

    POImap.loadAndParseOverpassJSON = function (overpassQueryUrl, callbackNode, callbackWay, callbackRelation) {
      var url = overpassQueryUrl.replace(/(BBOX)/g, map.getBounds().toOverpassBBoxString());
      $.getJSON(url, function (json) {
        POImap.parseOverpassJSON(json, callbackNode, callbackWay, callbackRelation);
      });
    };

    POImap.parseOverpassJSON = function (overpassJSON, callbackNode, callbackWay, callbackRelation) {
      var nodes = {}, ways = {};
      for (var i = 0; i < overpassJSON.elements.length; i++) {
        var p = overpassJSON.elements[i];
        switch (p.type) {
          case 'node':
            p.coordinates = [p.lon, p.lat];
            p.geometry = {type: 'Point', coordinates: p.coordinates};
            nodes[p.id] = p;
            // p has type=node, id, lat, lon, tags={k:v}, coordinates=[lon,lat], geometry
            if (typeof callbackNode === 'function') callbackNode(p);
            break;
          case 'way':
            p.coordinates = p.nodes.map(function (id) {
              return nodes[id].coordinates;
            });
            p.geometry = {type: 'LineString', coordinates: p.coordinates};
            ways[p.id] = p;
            // p has type=way, id, tags={k:v}, nodes=[id], coordinates=[[lon,lat]], geometry
            if (typeof callbackWay === 'function') callbackWay(p);
            break;
          case 'relation':
            if (!p.members) {
              console.log('Empty relation', p);
              break;
            }
            p.members.map(function (mem) {
              mem.obj = (mem.type == 'way' ? ways : nodes)[mem.ref];
            });
            // p has type=relaton, id, tags={k:v}, members=[{role, obj}]
            if (typeof callbackRelation === 'function') callbackRelation(p);
            break;
        }
      }
    };

    {# -------------------- #}
    {#        LOCATE        #}
    {# -------------------- #}

    var lc = L.control.locate({
    position: 'topright',
    strings: {
        title: "Show me where I am, yo!"
    }
    }).addTo(map);


    {# -------------------- #}
    {#       GPX LAYER      #}
    {# -------------------- #}

    {% if outputfile is not none %}
    var gpx = '../{{outputfile}}'
    
    gpx_overlay = new L.GPX(gpx, {async: true,
        polyline_options: {color:'red', 
            opacity: 1
        },
        marker_options: {
            startIconUrl: '{{ url_for('static', filename='img/markers/start.png') }}',
            endIconUrl: '{{ url_for('static', filename='img/markers/end.png') }}',
            shadowUrl: '{{ url_for('static', filename='img/markers/pin-shadow.png') }}',
            wptIconUrls: {
                'alpine_hut': '{{ url_for('static', filename='img/markers/alpine_hut.png') }}',
                'attraction': '{{ url_for('static', filename='img/markers/attraction.png') }}',
                'barrier': '{{ url_for('static', filename='img/markers/barrier.png') }}',
                'castle': '{{ url_for('static', filename='img/markers/castle.png') }}',
                'cave_entrance': '{{ url_for('static', filename='img/markers/cave.png') }}',
                'chapel': '{{ url_for('static', filename='img/markers/chapel.png') }}',
                'ford': '{{ url_for('static', filename='img/markers/ford.png') }}',
                'fountain': '{{ url_for('static', filename='img/markers/fountain.png') }}',
                'glacier': '{{ url_for('static', filename='img/markers/glacier.png') }}',
                'guidepost': '{{ url_for('static', filename='img/markers/guidepost2.png') }}',
                'lake': '{{ url_for('static', filename='img/markers/lake.png') }}',
                'locality': '{{ url_for('static', filename='img/markers/i.png') }}',
                'observatory': '{{ url_for('static', filename='img/markers/observatory.png') }}',
                'peak': '{{ url_for('static', filename='img/markers/peak.png') }}',
                'saddle': '{{ url_for('static', filename='img/markers/saddle.png') }}',
                'toilets': '{{ url_for('static', filename='img/markers/toilets.png') }}',
                'toposcope': '{{ url_for('static', filename='img/markers/toposcope.png') }}',
                'tree': '{{ url_for('static', filename='img/markers/tree.png') }}',
                'tunnel': '{{ url_for('static', filename='img/markers/tunnel.png') }}',
                'ruins': '{{ url_for('static', filename='img/markers/ruins.png') }}',
                'spring': '{{ url_for('static', filename='img/markers/water.png') }}',
                'shelter': '{{ url_for('static', filename='img/markers/shelter.png') }}',
                'viewpoint': '{{ url_for('static', filename='img/markers/viewpoint.png') }}',
                'volcano': '{{ url_for('static', filename='img/markers/volcano.png') }}',
                'drinking_water': '{{ url_for('static', filename='img/markers/water.png') }}',
                'water': '{{ url_for('static', filename='img/markers/water.png') }}',
                'waterfall': '{{ url_for('static', filename='img/markers/waterfall.png') }}', 
                'wilderness_hut': '{{ url_for('static', filename='img/markers/wilderness_hut.png') }}'
            },
            iconSize: [33, 50],
            popupAnchor:  [0, -40]
        }
    }).addTo(map); 

    // gpx_overlay_no_wpt = new L.GPX(gpx, {async: true,
    //     gpx_options:{parseElements: ['track', 'route']},
    //     polyline_options: {color:'red', 
    //         opacity: 1
    //     },
    //     marker_options: {
    //         startIconUrl: '{{ url_for('static', filename='img/markers/start.png') }}',
    //         endIconUrl: '{{ url_for('static', filename='img/markers/end.png') }}',
    //         shadowUrl: '{{ url_for('static', filename='img/markers/pin-shadow.png') }}',
    //     },
    // })

    {# -------------------- #}
    {#       GPX INFOS      #}
    {# -------------------- #}

    gpx_overlay.on('loaded', function(e) {
        $(".gpx-name").html( e.target.get_name());
        $(".gpx-name").attr('title', e.target.get_name());
        // 
        var dist_m = e.target.get_distance() / 1000
        $(".gpx-info-dist").html( dist_m.toFixed(2));
        var elev_gain = e.target.get_elevation_gain()
        $(".gpx-info-egain").html( elev_gain.toFixed(2));
        $(".gpx-info-wpt_number").html(e.target.get_wpt_number());
        if (elev_gain > 1){
            var container=el.onAdd(map);
            $("#elevation-div").html(container);
        }
        // console.log(e.target.get_elevation_data())
    })

    {# -------------------- #}
    {#    GPX ELEVATION     #}
    {# -------------------- #}

    var el = L.control.elevation({
        position:"topright",
        theme: "steelblue-theme", //default: lime-theme
        width: 300,
        height: 180,
        margins: {
            top: 10,
            right: 20,
            bottom: 25,
            left: 50
        },
        useHeightIndicator: true, //if false a marker is drawn at map position
        interpolation: "linear", //see https://github.com/mbostock/d3/wiki/SVG-Shapes#wiki-area_interpolate
        hoverNumber: {
            decimalsX: 3, //decimals on distance (always in km)
            decimalsY: 0, //deciamls on https://www.npmjs.com/package/leaflet.coordinatesight (always in m)
            formatter: undefined //custom formatter function may be injected
        },
        xTicks: undefined, //number of ticks in x axis, calculated by default according to width
        yTicks: undefined, //number of ticks on y axis, calculated by default according to height
        collapsed: true,  //collapsed mode, show chart on click or mouseover
    });
    
    gpx_overlay.on("addline",function(e){
        // console.log(e.line._latlngs)
        // TODO: remove null values
        el.addData(e.line);
    });


        {# -------------------- #}
        {#     QUERY STRINGS    #}
        {# -------------------- #}

        {% if map_qstr['zoom'] is none or map_qstr['lat'] is none or map_qstr['lon'] is none %}
            gpx_overlay.on('loaded', function(e) {
                map.fitBounds(e.target.getBounds());
            })
        {% endif %}
        {% if map_qstr['zoom'] is not none and map_qstr['lat'] is not none and map_qstr['lon'] is not none %}
            map.setView({lat:{{map_qstr['lat']}}, lng:{{map_qstr['lon']}}}, {{map_qstr['zoom']}})
        {% endif %}

    {% else %}
        {% if map_qstr['zoom'] is not none and map_qstr['lat'] is not none and map_qstr['lon'] is not none %}
            map.setView({lat:{{map_qstr['lat']}}, lng:{{map_qstr['lon']}}}, {{map_qstr['zoom']}})
        {% else %}
            {# Defaut value centered in france #}
            map.setView({lat:46.491, lng:2.197}, 6)
        {% endif  %}
    {% endif  %}

        
    {# -------------------- #}
    {#    MAP properties    #}
    {# -------------------- #}

    var baseLayers = {
        "OpenTopoMap": opentopo,
        "Mapy.cz": mapyCz,
        "OSM": osm,
        // 'OSM Fr': osmfr,
        "Open Cycle Map":osmcyclemap,
        "Mapbox / Streets": streets,
        "Mapbox / Grayscale": grayscale,
        "Mapbox / Outdoors": outdoors,
        "Mapbox / Satellite": satellite,
        "Google / Satellite": google
    };

    var overlayMaps = {
        {% if outputfile is not none %}
        "GPX": gpx_overlay,
        {% endif %}
        // "GPX no waypoint": gpx_overlay_no_wpt,
        "Strava Run / Blue": strava_overlay_b,
        "Strava Run / Red": strava_overlay_r,
        "Strava Bike / Blue": strava_bike_overlay,
        "Waymarkedtrails": lonvia_overlay,
        "Mapy.cz": mapyCz_overlay,
        "Hillshade": hillshade_overlay,
        "Flickr" : flickr,
        // "Clouds": clouds,
        // "Temperature": temp,
        "Wikipedia" : wiki,
        "Parking": overpass_parking,
        "Guidepost":overpass_guidepost,
        // "Massifs Alpins":dataLayer,
    };
    
    var layerControl = L.control.layers(baseLayers, overlayMaps).addTo(map);

    var sidebar = L.control.sidebar('sidebar').addTo(map);
    $(document).ready(function () {
        sidebar.open('home');
    });


    {# -------------------- #}
    {# QUERY STRING UPDATES #}
    {# -------------------- #}

    function getParameterByName(name, url) {
        // Taken from:
        // http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
        if (!url) {
          url = window.location.href;
        }
        name = name.replace(/[\[\]]/g, "\\$&");
        var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
            results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, " "));
    }

    var qstr_map_val = getParameterByName('map');
    var qstr_layer_val = getParameterByName('layer');
    var qstr_overlay_val = getParameterByName('overlay');
    window.qstr_map = "?map=" + qstr_map_val
    window.qstr_layer = "&layer=" + qstr_layer_val
    window.qstr_overlay = "&overlay=" + qstr_overlay_val

    map.on('moveend', function(e) {
            lat_new = map.getCenter().lat.toFixed(4)
            lon_new = map.getCenter().lng.toFixed(4)
            zoom_new = map.getZoom().toString()
            window.qstr_map = "?map=" + zoom_new + '/' + lat_new + '/' + lon_new
            // console.log(qstr_map)
            var stateObj = {};
            history.pushState(
                stateObj, "", 
                window.qstr_map + window.qstr_layer + window.qstr_overlay
            );
    });

    var layer_dict = {
      "OpenTopoMap": 1,
      "Mapy.cz": 2,
      "OSM": 3,
      "Open Cycle Map": 4,
      "Mapbox / Streets": 5,
      "Mapbox / Grayscale": 6,
      "Mapbox / Outdoors": 7,
      "Mapbox / Satellite": 8,
      "Google / Satellite": 9,
    };

    map.on('baselayerchange ', function(e) {
        layer_id = layer_dict[e.name]
        if (layer_id == null){layer_id = 1}
        // console.log(layer_id)
        var stateObj = {};
        window.qstr_layer = "&layer=" + layer_id
        history.pushState(stateObj, "", window.qstr_map + window.qstr_layer + window.qstr_overlay);
    });

    var layer_overlay = {
      "Strava Run / Blue": "A",
      "Strava Run / Red": "B",
      "Strava Bike / Blue": "C",
      "Waymarkedtrails": "D",
      "Mapy.cz": "E",
      "Hillshade": "F",
      "Flickr": "G",
      "Parking": "H",
      "Wikipedia": "I",
      "Hiking trail difficulty": "J",
    };

    map.on('overlayadd ', function(e) {
        overlay = layer_overlay[e.name]
        if (overlay == null){return}
        var stateObj = {};
        window.qstr_overlay = window.qstr_overlay.replace('null','')
        window.qstr_overlay = window.qstr_overlay + overlay
        window.qstr_overlay = window.qstr_overlay.replace('GG','G')
        window.qstr_overlay = window.qstr_overlay.replace('JJ','J')
        history.pushState(stateObj, "", window.qstr_map + window.qstr_layer + window.qstr_overlay);
    });

    map.on('overlayremove ', function(e) {
        overlay = layer_overlay[e.name]
        if (overlay != null){
            var stateObj = {};
            window.qstr_overlay = window.qstr_overlay.replace('null','')
            window.qstr_overlay = window.qstr_overlay.replace(overlay,'')
            history.pushState(stateObj, "", window.qstr_map + window.qstr_layer + window.qstr_overlay);
        }
    });

    {# -------------------- #}
    {#       LINKS TAB      #}
    {# -------------------- #}

    // http://stackoverflow.com/questions/3272715/issue-with-onclick-and-middle-button-on-mouse
    // .bind('mouseup', function(e){

    $(function() {
        $("#TPElink").click(function(e) {
          e.preventDefault(); // if desired...
          var url = 'http://app.photoephemeris.com/?ll=' + [
                        map.getCenter().wrap().lat, ',',
                        map.getCenter().wrap().lng, '&z=',
                        map.getZoom()
                    ].join('');
          console.log(url)
          window.open(url, '_blank');               
        });
    });

    $(function() {
        $("#iDlink").click(function(e) {
          e.preventDefault(); // if desired...
          var url = 'http://www.openstreetmap.org/edit#map=' + [
                        map.getZoom(),
                        map.getCenter().wrap().lat,
                        map.getCenter().wrap().lng
                    ].join('/');
          console.log(url)
          window.open(url, '_blank');               
        });
    });

    $(function() {
        $("#SiDlink").click(function(e) {
          e.preventDefault(); // if desired...
          var url = 'http://strava.github.io/iD/#background=Bing&map=' + [
                        map.getZoom(),
                        map.getCenter().wrap().lng,
                        map.getCenter().wrap().lat
                    ].join('/');
          console.log(url)
          window.open(url, '_blank');               
        });
    });

    $(function() {
        $("#IGNlink").click(function(e) {
          e.preventDefault(); // if desired...
          var url = 'http://mavisionneuse.ign.fr/visio.html?' + [
                        'lon=',
                        map.getCenter().wrap().lng,
                        '&lat=',
                        map.getCenter().wrap().lat,
                        '&zoom=',
                        map.getZoom(),
                        '&num=2&mt0=ign-cartes&mt1=osmfr'
                    ].join('');
          console.log(url)
          window.open(url, '_blank');               
        });
    });


</script>
</body>
</html>