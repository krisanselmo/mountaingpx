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
                <br> Add <a href="http://www.openstreetmap.org/" target="_blank">OSM</a> waypoints on your GPX
                <br> <i> - work in progress - </i>
                <!-- <a id="about_link" href="#" role="button">about</a> -->

                <!-- <div id="drop_zone">Drop gpx file here or -->

                <form action="?" method=post enctype=multipart/form-data>
                    <div class="input-file-container">  
                        <input class="input-file" id="my-file" type="file" name=file>
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
            <span class="gpx-name"> </span> <br>
            Distance: <span class="gpx-info-dist"> </span> km<br>
            Elevation: <span class="gpx-info-egain"> </span> m<br>
            Waypoints: <span class="gpx-info-wpt_number"> </span>
        </div> 
    </div>

    {# // BOX \\ #}
    <div class="info elevation steelblue-theme leaflet-control">
        <div id="elevation-div"></div>
    </div>
    {% endif %}

</div>



<!-- #map > div.leaflet-control-container > div.leaflet-leftpane > div.elevation.steelblue-theme.leaflet-control -->

    


    <!-- <div class="info leaflet-control">
    test -->
    <!-- $("#s5").dropdownchecklist({ firstItemChecksAll: true, explicitClose: '...close' }); -->
    <!-- http://dropdownchecklist.sourceforge.net/ -->
    <!-- </div>   -->





<!-- POSITION ZOOM -->
<!-- http://stackoverflow.com/questions/33614912/how-to-locate-leaflet-zoom-control-in-a-desired-position -->


<!-- <div class="leaflet-control-zoom leaflet-bar leaflet-control">
    <a class="leaflet-control-zoom-in" href="#" title="Zoom in">+</a>
    <a class="leaflet-control-zoom-out" href="#" title="Zoom out">-</a>
</div>
 -->



    

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
{# https://www.html5rocks.com/en/tutorials/file/dndfiles/ #}

    // function handleFileSelect(evt) {
    //     evt.stopPropagation();
    //     evt.preventDefault();

    //     var files = evt.dataTransfer.files; // FileList object.

    //     // files is a FileList of File objects. List some properties.
    //     var output = [];
    //     output.push(escape(files[0].name));

    //     // document.getElementById('up_filename').innerHTML = output.join('');
    //     $("#up_filename").html(output.join(''));

    //     // the_return = document.querySelector(".file-return");
    // }

    // function handleDragOver(evt) {
    //     evt.stopPropagation();
    //     evt.preventDefault();
    //     evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
    // }

    // // Setup the dnd listeners.
    // var dropZone = document.getElementById('drop_zone');
    //     dropZone.addEventListener('dragover', handleDragOver, false);
    //     dropZone.addEventListener('drop', handleFileSelect, false);

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
            attribution: osmAttr,
            errorTileUrl: "http://b.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
            attribution: lonviaAttr
        });

    var hillshade_overlay = L.tileLayer("http://c.tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png", {
            zIndex: 10, 
            opacity: 0.75, 
            attribution: lonviaAttr
        });
        
    
    var flickr = new L.Flickr('a06f677e097235ad98d9f0961d44252c',{maxLoad: 25, maxTotal: 250});      



    {% if layer_name is none %}
        // map_layers = [opentopo, strava_overlay_b, mapyCz_overlay];
        map_layers = [opentopo];
    {% else %}
        map_layers = [{{layer_name}}];
    {% endif %}


    {% if overlay_lst is defined %}
        {% for item in overlay_lst %}
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




    //OverPassAPI overlay


    // Exemple avec les ways
    // https://github.com/simon04/POImap/blob/master/map.js



    var opl = new L.OverPassLayer({
      endpoint: "http://api.openstreetmap.fr/oapi/",
      query: "node(BBOX)['natural'='peak'];out;",
      minzoom: 14,
      minZoomIndicatorOptions: {
        minZoomMessage: ""
      }
    });
    map.addLayer(opl);


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
                'cave_entrance': '{{ url_for('static', filename='img/markers/cave.png') }}',    
                'chapel': '{{ url_for('static', filename='img/markers/chapel.png') }}', 
                'ford': '{{ url_for('static', filename='img/markers/ford.png') }}',   
                'fountain': '{{ url_for('static', filename='img/markers/fountain.png') }}',
                'glacier': '{{ url_for('static', filename='img/markers/glacier.png') }}',
                'guidepost': '{{ url_for('static', filename='img/markers/guidepost.png') }}',
                'lake': '{{ url_for('static', filename='img/markers/lake.png') }}',
                'peak': '{{ url_for('static', filename='img/markers/peak.png') }}',          
                'saddle': '{{ url_for('static', filename='img/markers/saddle.png') }}',    
                'toilets': '{{ url_for('static', filename='img/markers/toilets.png') }}',     
                'toposcope': '{{ url_for('static', filename='img/markers/toposcope.png') }}',
                'tree': '{{ url_for('static', filename='img/markers/tree.png') }}',
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



      //document.getElementById("dist").innerHTML = e.target.get_distance() / 1000;
    
    
    gpx_overlay.on('loaded', function(e) {
        $(".gpx-name").html( e.target.get_name());
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
        imperial: false    //display imperial units instead of metric
    });
    // el.addTo(map);

    // var el = L.control.elevation();
    


    gpx_overlay.on("addline",function(e){
        el.addData(e.line);
    });
    // gpx_overlay.addTo(map);

   



    // gpx_overlay.onAdd(map);

    // $("#elevation-div").html(container);


 

    // gpx_overlay.on('popupopen', function(e) {
    //     console.log(e.target.get_elevation_max())
    // })



        {% if zoom is none or lat is none or lon is none %}
            gpx_overlay.on('loaded', function(e) {
                map.fitBounds(e.target.getBounds());
            })
        {% endif %}
        {% if zoom is not none and lat is not none and lon is not none %}
        map.setView({lat:{{lat}}, lng:{{lon}}}, {{zoom}})
        {% endif %}

    {% else %}
        {# Defaut value centered in france #}
        map.setView({lat:46.491, lng:2.197}, 6)
    {% endif  %}

        
    var baseLayers = {
        "OpenTopoMap": opentopo,
        "Mapy.cz": mapyCz,
        "OSM": osm,
        "Mapbox / Streets": streets,
        "Mapbox / Grayscale": grayscale,
        "Mapbox / Outdoors": outdoors,
        "Mapbox / Satellite": satellite,
        "Google / Satellite": google
    };


 

   // Add a Wikipedia layer
    // var wiki = new L.layerGroup.wikipediaLayer();


    var overlayMaps = {
        "Strava Run / Blue": strava_overlay_b,
        "Strava Run / Red": strava_overlay_r,
        "Strava Bike / Blue": strava_bike_overlay,
        "Waymarkedtrails": lonvia_overlay,
        "Mapy.cz": mapyCz_overlay,
        "Hillshade": hillshade_overlay,
        "Flickr" : flickr,
        // "Wikipedia" : wiki
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
        
        
// --------------------------------

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



{# QUERY STRING UPDATES #}


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


map.on('baselayerchange ', function(e) {
    switch(e.name) {
        case "OpenTopoMap":
            layer = 1;
            break;
        case "Mapy.cz":
            layer = 2;
            break;
        case "OSM":
            layer = 3;
            break;
        case "Mapbox / Streets":
            layer = 4;
            break;
        case "Mapbox / Grayscale":
            layer = 5;
            break;
        case "Mapbox / Outdoors":
            layer = 6;
            break;
        case "Mapbox / Satellite":
            layer = 7;
            break;
         case "Google / Satellite":
            layer = 8;
            break;
        default:
            layer = 1;
    }
    var stateObj = {};
    window.qstr_layer = "&layer=" + layer
    history.pushState(stateObj, "", window.qstr_map + window.qstr_layer + window.qstr_overlay);
});


map.on('overlayadd ', function(e) {
    // console.log(e.name)
    switch(e.name) {
        case "Strava Run / Blue":
            layer = 'A';
            break;
        case "Strava Run / Red":
            layer = 'B';
            break;
        case "Strava Bike / Blue":
            layer = 'C';
            break;
        case "Waymarkedtrails":
            layer = 'D';
            break;
        case "Mapy.cz":
            layer = 'E';
            break;
        case "Hillshade":
            layer = 'F';
            break;
        case "Flickr":
            layer = 'G';
            break;
        default:
            layer = '';
    }
    var stateObj = {};
    window.qstr_overlay = window.qstr_overlay.replace('null','')
    window.qstr_overlay = window.qstr_overlay.replace('G','')
    window.qstr_overlay = window.qstr_overlay + layer
    history.pushState(stateObj, "", window.qstr_map + window.qstr_layer + window.qstr_overlay);
});

map.on('overlayremove ', function(e) {
    // console.log(e.name)
    switch(e.name) {
        case "Strava Run / Blue":
            overlay = 'A';
            break;
        case "Strava Run / Red":
            overlay = 'B';
            break;
        case "Strava Bike / Blue":
            overlay = 'C';
            break;
        case "Waymarkedtrails":
            overlay = 'D';
            break;
        case "Mapy.cz":
            overlay = 'E';
            break;
        case "Hillshade":
            overlay = 'F';
            break;
        case "Flickr":
            overlay = 'G';
            break;
        default:
            overlay = '';
    }
    var stateObj = {};
    window.qstr_overlay = window.qstr_overlay.replace('null','')
    window.qstr_overlay = window.qstr_overlay.replace(overlay,'')
    history.pushState(stateObj, "", window.qstr_map + window.qstr_layer + window.qstr_overlay);
});

{# END QUERY STRING UPDATES #}


</script>
</body>
</html>
