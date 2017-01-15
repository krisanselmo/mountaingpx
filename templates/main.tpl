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
    <link rel='stylesheet' id='input_button'  href="{{ url_for('static', filename='button.css') }}" type='text/css' media='all' />
    <link rel='stylesheet' href="{{ url_for('static', filename='leaflet.elevation-0.0.4_kris.css') }}" type='text/css'/>
    <link rel='stylesheet' href="{{ url_for('static', filename='cssapp.css') }}" type='text/css'/>
    <style type="text/css"> .fullscreen-icon { background-image: url({{ url_for('static', filename='img/icon-fullscreen.png') }}); }  </style>
    {# -- JAVASCRIPT -- #}
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js"></script>
    <script src="https://unpkg.com/leaflet@1.0.2/dist/leaflet.js"></script>
    <script src="http://d3js.org/d3.v3.min.js" charset="utf-8"></script> {# For Elevation #}
    <script src="{{ url_for('static', filename='Control.FullScreen.js') }}"></script>
    <script src="{{ url_for('static', filename='gpx.js') }}"></script>
    <script src="{{ url_for('static', filename='Leaflet.EditInOSM.js') }}"></script> {# https://github.com/yohanboniface/Leaflet.EditInOSM #}
    <script src="{{ url_for('static', filename='Flickr.js') }}"></script> {# https://github.com/shurshur/Leaflet.Flickr #}
    <script src="{{ url_for('static', filename='leaflet.elevation-0.0.4.src.js') }}"> </script>




    <script src="{{ url_for('static', filename='jsonp.min.js') }}"> </script> {#wiki dependency#}
    <script src="{{ url_for('static', filename='leaflet-wikipedia.js') }}"> </script> {#https://github.com/MatthewBarker/leaflet-wikipedia#}
    <!-- <script src='//api.tiles.mapbox.com/mapbox.js/plugins/leaflet-omnivore/v0.3.1/leaflet-omnivore.min.js'></script>  -->



    <!-- http://openweathermap.org/hugemaps -->
    <!-- https://github.com/buche/leaflet-openweathermap -->
    <link rel="stylesheet" type="text/css" href="{{ url_for('static', filename='leaflet-openweathermap.css') }}" />
    <script type="text/javascript" src="{{ url_for('static', filename='leaflet-openweathermap.js') }}"></script>


    {# Other 
    <!-- <script src="{{ url_for('static', filename='map.js') }}"></script> -->
    <!-- <script src='//api.tiles.mapbox.com/mapbox.js/plugins/leaflet-omnivore/v0.3.1/leaflet-omnivore.min.js'></script> -->
    <!--<script src='https://api.mapbox.com/mapbox.js/plugins/leaflet-omnivore/v0.2.0/leaflet-omnivore.min.js'></script>  -->
    <!-- <script src="https://rawgithub.com/mpetazzoni/leaflet-gpx/master/gpx.js"></script> -->
    <!-- <script src="{{ url_for('static', filename='leaflet-wikipedia.js') }}"></script> -->
    #}

    {# Test section #}
    <script src="{{ url_for('static', filename='OverPassLayer.js') }}"></script>
    <link rel='stylesheet' href="{{ url_for('static', filename='OverPassLayer.css') }}" type='text/css'/>

</head>
<body>
<div style="visibility:hidden; opacity:0" id="dropzone"></div>

<div class="leftpane">
    {# // BOX \\ #}
    <div class="info leaflet-control">
        <div id="header" class="">
            <div class="title"><span class="title-name"> <b>Mountain GPX</b> </span><sup class="version">beta!</sup>&nbsp;
                <a href="{{ url_for('help') }}">
                    <img src="{{ url_for('static', filename='img/help.svg') }}" alt="Help" height="16px" width="16px" />
                </a>
            </div>
            <div class="header-text">

                <!-- 'esc' or 'q' to disable drawing, 'd' to enable drawing-->
                <br> Automatically add waypoints on your GPX from <a href="http://www.openstreetmap.org/" target="_blank">OSM</a> database
                <br> <span class='wip'> - work in progress - </span>
                <!-- <a id="about_link" href="#" role="button">about</a> -->

                <!-- <div id="drop_zone">Drop gpx file here or -->

                <form action="?" method=post enctype=multipart/form-data id="form_id">
                    <div class="input-file-container">  
                        <input class="input-file" id="my-file" type="file" accept=".gpx" name=file>
                        <label tabindex="0" for="my-file" class="input-file-trigger">select a GPX file...</label>
                    </div>
                    <div id="up_filename"> 
                        <!-- <p class="file-return"></p> -->
                    </div>
                    <input type=submit value=Upload>
                </form>

                <div class="msg_flsh">  
                {% with messages = get_flashed_messages() %}
                {% if messages %}
                {{ messages[0] }}  {# Pas sur de la notation ici  #}
                {% endif %}
                {% endwith %}
                </div>
            </div>
        </div>
    </div>

    {% if outputfile is not none %}
    {# // BOX \\ #}
    <div class="info leaflet-control">
        <div class="heading">Download</div>
        <div class="content">
            <div class="value"><a href='../{{outputfile}}'>GPX</a></div>
        </div>
    </div>

    {# // BOX \\ #}
    <div class="info leaflet-control">
        <div class="heading">Infos</div>
        <div class="content">
            <div class="gpx-name" title="test"></div><br>
            Distance: <span title="Distance 2d" class="gpx-info-dist"> </span> km<br>
            Elevation: <span title="Raw elevation data" class="gpx-info-egain"> </span> m<br>
            Waypoints: <span class="gpx-info-wpt_number"> </span>
        </div> 
    </div>

    {# // BOX \\ #}
    <div class="info elevation steelblue-theme leaflet-control">
        <div id="elevation-div"></div>
    </div>

    <div class="info listwpt steelblue-theme leaflet-control">
        <div id="listwpt-div"></div>
    </div>
    {% endif %}

</div>



    <!-- <div class="info leaflet-control">
    test -->
    <!-- $("#s5").dropdownchecklist({ firstItemChecksAll: true, explicitClose: '...close' }); -->
    <!-- http://dropdownchecklist.sourceforge.net/ -->
    <!-- </div>   -->





<!-- POSITION ZOOM -->
<!-- http://stackoverflow.com/questions/33614912/how-to-locate-leaflet-zoom-control-in-a-desired-position -->



    

    <!-- https://www.html5rocks.com/en/tutorials/file/dndfiles/ -->
<script>


    // img/icon-fullscreen.png

// Check for the various File API support.
    if (window.File && window.FileReader && window.FileList && window.Blob) {
      // Great success! All the File APIs are supported.
    } 
    else {
      alert('The File APIs are not fully supported in this browser.');
    }


{# ----  Button ----- #}
    
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
        // files = this.value
        // console.log(files[0])
        $("#up_filename").html(this.files[0].name);
        // the_return.innerHTML = this.value;  
        // document.getElementById('list').innerHTML = this.value
    });  


{# ----  Drop zone ----- #}

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
    
    var opentopoAttr = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
            'Imagery &copy <a href="https://opentopomap.org">OpenTopoMap</a>',
        opentopoUrl = 'http://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        opentopo = L.tileLayer(opentopoUrl, {
            attribution: opentopoAttr,
            maxZoom:17
        });

    var osmAttr = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
            'Imagery &copy <a href="https://opentopomap.org">OpenTopoMap</a>',
        osm = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
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
        
    var clouds = L.OWM.clouds({showLegend: true, opacity: 0.5});
    var temp = L.OWM.temperature({showLegend: true, legendPosition: 'bottomright', opacity: 0.5});
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
            minzoom: 12,

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




    {% if layer_qstr is none %}
        // map_layers = [opentopo, strava_overlay_b, mapyCz_overlay];
        map_layers = [opentopo];
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
        zoomControl: false,
        fullscreenControl: true,
        fullscreenControlOptions: { // optional
            position: 'topright',
            title:"Show me the fullscreen !",
            titleCancel:"Exit fullscreen mode"
        },
        editInOSMControlOptions: {position: 'bottomleft'},
        layers: map_layers
    });
    
    L.control.zoom({
        position:'topright'
    }).addTo(map);

///////////////////////////////////////

// 


    var nodes = {}, ways = {};
    $(function () {
      // map = POImap.init();
      layer_trail_sac = new L.GeoJSON(null, {
        onEachFeature: function (e, layer_trail_sac) {
          if (e.properties && e.properties.name) layer_trail_sac.bindPopup(e.properties.name);
          if (e.properties && e.properties.style) layer_trail_sac.setStyle(e.properties.style);
        }
      });
       // map.addLayer(layer_trail_sac);
      // this.addLayer(m);
      // map.zoomIn();
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
          r.append($('<tr>').append($('<th>').text('ID')).append($('<td>').text(id).append(' ').append($('<a>').attr({href: 'href="//localhost:8111/load_object?objects='+type+id, target: '_blank'}).text('edit')).append(' ').append($('<a>').attr({href: '//www.openstreetmap.org/browse/'+{w:'way',n:'node',r:'relation'}[type]+'/'+id, target: '_blank'}).text('browse'))));
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


    // '//www.overpass-api.de/api/interpreter?data=[out:json];(way["highway"="path"]["sac_scale"](BBOX);node(w));out;',
    // 'http://api.openstreetmap.fr/oapi/interpreter'


    var POImap = {};

    POImap.init = function () {
        var attr_osm = 'Map data &copy; <a href="//openstreetmap.org/">OpenStreetMap</a> contributors',
            attr_overpass = 'POI via <a href="//www.overpass-api.de/">Overpass API</a>';

        var osm = new L.TileLayer('//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution: [attr_osm, attr_overpass].join(', ')}),
        transport = new L.TileLayer('//{s}.tile2.opencyclemap.org/transport/{z}/{x}/{y}.png', {opacity: 0.5, attribution: ['<a href="http://blog.gravitystorm.co.uk/2011/04/11/transport-map/">Gravitystorm Transport Map</a>', attr_osm, attr_overpass].join(', ')}),
        osm_bw = new L.TileLayer('//{s}.www.toolserver.org/tiles/bw-mapnik/{z}/{x}/{y}.png', {opacity: 0.5, attribution: [attr_osm, attr_overpass].join(', ')}),
        osm_no = new L.TileLayer('//{s}.www.toolserver.org/tiles/osm-no-labels/{z}/{x}/{y}.png', {attribution: [attr_osm, attr_overpass].join(', ')});

        map = new L.Map('map', {
            center: new L.LatLng(45.8501, 6.8670),
            zoom: 13,
            layers: osm
        });

        map.getControl = function () {
            var ctrl = new L.Control.Layers({
               'OpenSteetMap': osm,
               'OpenSteetMap (no labels)': osm_no,
               'OpenSteetMap (black/white)': osm_bw,
               'Transport Map': transport
            });
            return function () {
                  return ctrl;
            };
        }();
        map.addControl(map.getControl());

        L.LatLngBounds.prototype.toOverpassBBoxString = function (){
            var a = this._southWest,
                b = this._northEast;
            return [a.lat, a.lng, b.lat, b.lng].join(",");
        };

        var path_style = L.Path.prototype._updateStyle;
            L.Path.prototype._updateStyle = function () {
            path_style.apply(this);
            for (var k in this.options.svg) {
              this._path.setAttribute(k, this.options.svg[k]);
            }
        };

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function (position) {
              var center = new L.LatLng(position.coords.latitude, position.coords.longitude);
              map.setView(center, 13);
            });
        }

        POImap.map = map;
        return map;
    };

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

// 


//////////////////////////////////////


    //OverPassAPI overlay


    // Exemple avec les ways
    // https://github.com/simon04/POImap/blob/master/map.js








//   options: {
//   endpoint: "http://overpass.osm.rambler.ru/cgi/",
//   query: "node(BBOX)['amenity'='post_box'];out;",
//   debug: false,
//   callback: function(data) {
//     for(var i=0;i<data.elements.length;i++) {
//       var e = data.elements[i];

//       if (e.id in this.instance._ids) return;
//       this.instance._ids[e.id] = true;
//       var pos = new L.LatLng(e.lat, e.lon);
//       var popup = this.instance._poiInfo(e.tags,e.id);
//       var color = e.tags.collection_times ? 'green':'red';
//       var circle = L.circle(pos, 50, {
//         color: color,
//         fillColor: '#fa3',
//         fillOpacity: 0.5
//       })
//       .bindPopup(popup);
//       this.instance.addLayer(circle);
//     }
//   },
//   minZoomIndicatorOptions: {
//     position: 'topright',
//     minZoomMessageNoLayer: "no layer assigned",
//     minZoomMessage: "current Zoom-Level: CURRENTZOOM all data at Level: MINZOOMLEVEL"
//   }
// };

    // omnivore.kml('{{ url_for('static', filename='carte_des_topos.kml') }}').addTo(map);


    {% if outputfile is not none %}
    var gpx = '../{{outputfile}}'
    // var gpx = '{{ url_for('static', filename='{{outputfile}}') }}'
    
    gpx_overlay = new L.GPX(gpx, {async: true,
        polyline_options: {color:'red', 
            opacity: 1
        },
        // display_wpt:false,  https://github.com/shramov/leaflet-plugins/blob/master/layer/vector/GPX.js
        marker_options: {
            startIconUrl: '{{ url_for('static', filename='img/markers/start.png') }}',
            endIconUrl: '{{ url_for('static', filename='img/markers/end.png') }}',
            shadowUrl: '{{ url_for('static', filename='img/markers/pin-shadow.png') }}',
            wptIconUrls: {
                'alpine_hut': '{{ url_for('static', filename='img/markers/alpine_hut.png') }}',    
                'barrier': '{{ url_for('static', filename='img/markers/barrier.png') }}',   
                'castle': '{{ url_for('static', filename='img/markers/castle.png') }}',    
                'cave_entrance': '{{ url_for('static', filename='img/markers/cave.png') }}', 
                'chapel': '{{ url_for('static', filename='img/markers/chapel.png') }}', 
                'ford': '{{ url_for('static', filename='img/markers/ford.png') }}',   
                'fountain': '{{ url_for('static', filename='img/markers/fountain.png') }}',
                'glacier': '{{ url_for('static', filename='img/markers/glacier.png') }}',
                'guidepost': '{{ url_for('static', filename='img/markers/guidepost2.png') }}',
                'lake': '{{ url_for('static', filename='img/markers/lake.png') }}',
                'observatory': '{{ url_for('static', filename='img/markers/observatory.png') }}',
                'peak': '{{ url_for('static', filename='img/markers/peak.png') }}',          
                'saddle': '{{ url_for('static', filename='img/markers/saddle.png') }}',    
                'toilets': '{{ url_for('static', filename='img/markers/toilets.png') }}',     
                'toposcope': '{{ url_for('static', filename='img/markers/toposcope.png') }}',
                'tree': '{{ url_for('static', filename='img/markers/tree.png') }}',
                'ruins': '{{ url_for('static', filename='img/markers/ruins.png') }}',
                'spring': '{{ url_for('static', filename='img/markers/water.png') }}',  
                'shelter': '{{ url_for('static', filename='img/markers/shelter.png') }}',
                'viewpoint': '{{ url_for('static', filename='img/markers/viewpoint.png') }}',
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


    var el = L.control.elevation({
        position:"topright",
        theme: "steelblue-theme", //default: lime-theme
        width: 260,
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

    // var el = L.control.elevation();
    
    gpx_overlay.on("addline",function(e){
        // console.log(e.line)
        // TODO: remove null values
        el.addData(e.line);
    });



   



    // gpx_overlay.onAdd(map);

    // $("#elevation-div").html(container);


 

    // gpx_overlay.on('popupopen', function(e) {
    //     console.log(e.target.get_elevation_max())
    // })



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


 

   // Add a Wikipedia layer
    // var wiki = new L.layerGroup.wikipediaLayer();

    

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
        "Clouds": clouds,
        "Temperature": temp,
        "Wikipedia" : wiki,
        "Parking": overpass_parking,
        // "Trails difficulty": layer_trail_sac,
    };
    
    L.control.layers(baseLayers, overlayMaps).addTo(map);
    //L.control.layers(strava).addTo(map);
    
    // detect fullscreen toggling
    map.on('enterFullscreen', function(){
        if(window.console) window.console.log('enterFullscreen');
    });
    map.on('exitFullscreen', function(){
        if(window.console) window.console.log('exitFullscreen');
    });
        
        









{#
// create custom icon
    var firefoxIcon = L.icon({
        iconUrl: '{{ url_for('static', filename='img/alpine_hut.png') }}',
        iconSize: [38, 95], // size of the icon
        popupAnchor: [0,-15]
        });



    // create popup contents
    var customPopup = "Mozilla Toronto Offices<br/><img src='http://joshuafrazier.info/images/maptime.gif' alt='maptime logo gif' width='350px'/>";
    
    // specify popup options 
    var customOptions =
        {
        'maxWidth': '500',
        'className' : 'custom'
        }
    
    // create marker object, pass custom icon as option, pass content and options to popup, add to map
    L.marker([43.6974560, 6.1748813], {icon: firefoxIcon}).bindPopup(customPopup,customOptions).addTo(map);

#}

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
    console.log(layer_id)
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
};

map.on('overlayadd ', function(e) {
    overlay = layer_overlay[e.name]
    if (overlay == null){return}
    var stateObj = {};
    window.qstr_overlay = window.qstr_overlay.replace('null','')
    // window.qstr_overlay = window.qstr_overlay.replace('G','')
    window.qstr_overlay = window.qstr_overlay + overlay
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

{# END QUERY STRING UPDATES #}

</script>
</body>
</html>
