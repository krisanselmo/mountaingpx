
<!DOCTYPE html>
{# 

    https://github.com/brunob/leaflet.fullscreen
    https://keep.google.com/#NOTE/1481497142074.280328407
    https://github.com/mpetazzoni/leaflet-gpx

#}
<html>
<head>
    
    <title>OSM Waypoints</title>

    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <link rel="shortcut icon" href={{ url_for('static', filename='favicon.ico') }}/>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.0.2/dist/leaflet.css" />
    <style type="text/css">
        html, body, #map {
            width: 99%;
            height: 98%;
        }
        #map {
            position: relative;
            width: 75%;
            height: 90%;
            margin-left: auto;
            margin-right: auto;
            margin-top: 15px;
        }
        .fullscreen-icon { background-image: url({{ url_for('static', filename='img/icon-fullscreen.png') }}); }
        /* one selector per rule as explained here : http://www.sitepoint.com/html5-full-screen-api/ */
        #map:-webkit-full-screen { width: 100% !important; height: 100% !important; z-index: 99999; }
        #map:-ms-fullscreen { width: 100% !important; height: 100% !important; z-index: 99999; }
        #map:full-screen { width: 100% !important; height: 100% !important; z-index: 99999; }
        #map:fullscreen { width: 100% !important; height: 100% !important; z-index: 99999; }
        .leaflet-pseudo-fullscreen { position: fixed !important; width: 100% !important; height: 100% !important; top: 0px !important; left: 0px !important; z-index: 99999; }
    
        #drop_zone {
            width: 250px;
            margin-left: auto;
            margin-right: auto;
            
            border: 2px dashed #bbb;
            border-radius: 10px;
            padding: 10px;
            margin-top: 15px;
            text-align: center;
            font: 15pt "Tahoma", sans-serif;
            color: #bbb;
        }
        #list {
            margin-left: auto;
            margin-right: auto;
            font: 10pt "Tahoma", sans-serif;
            color: #bbb;
        }


    </style>
    <link rel='stylesheet' id='input_button'  href="{{ url_for('static', filename='button.css') }}" type='text/css' media='all' />
    
    <script src="https://unpkg.com/leaflet@1.0.2/dist/leaflet.js"></script>
    <script src="{{ url_for('static', filename='Control.FullScreen.js') }}"></script>

    <!-- <script src='//api.tiles.mapbox.com/mapbox.js/plugins/leaflet-omnivore/v0.3.1/leaflet-omnivore.min.js'></script> -->
    <!--<script src='https://api.mapbox.com/mapbox.js/plugins/leaflet-omnivore/v0.2.0/leaflet-omnivore.min.js'></script>  -->
    <script src="https://rawgithub.com/mpetazzoni/leaflet-gpx/master/gpx.js"></script>
    <script src="{{ url_for('static', filename='Leaflet.EditInOSM.js') }}"></script> {# https://github.com/yohanboniface/Leaflet.EditInOSM #}
    <script src="{{ url_for('static', filename='Flickr.js') }}"></script> {# https://github.com/shurshur/Leaflet.Flickr #}
    
</head>
<body>

<!-- 
<form action="" method=post enctype=multipart/form-data>
      <p><input type=file name=file>
        <input type=submit value=Upload>
    </form>
 -->


    <div id="drop_zone">Drop gpx file here or
        
        <form action="?" method=post enctype=multipart/form-data>

            <div class="input-file-container">  
                <input class="input-file" id="my-file" type="file" name=file>
                <label tabindex="0" for="my-file" class="input-file-trigger">select a file...</label>
            </div>
            <input type=submit value=Upload>
        </form>


        {% with messages = get_flashed_messages() %}
        {% if messages %}
        {{ messages[0] }}  {# Pas sur de la notation ici  #}
        {% endif %}
        {% endwith %}


        <div id="list"> 
          <p class="file-return"></p>
        </div>

    </div>
 


    <!-- <input type="file" id="file" accept=".gpx"> -->
    


    <!-- https://www.html5rocks.com/en/tutorials/file/dndfiles/ -->


<script>

// Check for the various File API support.
    if (window.File && window.FileReader && window.FileList && window.Blob) {
      // Great success! All the File APIs are supported.
    } 
    else {
      alert('The File APIs are not fully supported in this browser.');
    }


// -------------------

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
        the_return.innerHTML = this.value;  
        // document.getElementById('list').innerHTML = this.value
    });  


// -------------------

    function handleFileSelect(evt) {
    evt.stopPropagation();
    evt.preventDefault();

    var files = evt.dataTransfer.files; // FileList object.

    // files is a FileList of File objects. List some properties.
    var output = [];
    f = files[0]
    output.push('<p><strong>', escape(f.name), '</strong></p>');
    
    document.getElementById('list').innerHTML = '<ul>' + output.join('') + '</ul>';
    // the_return = document.querySelector(".file-return");
  }

  function handleDragOver(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
  }

  // Setup the dnd listeners.
  var dropZone = document.getElementById('drop_zone');
  dropZone.addEventListener('dragover', handleDragOver, false);
  dropZone.addEventListener('drop', handleFileSelect, false);
</script>


<div id='map'></div>


<script>
    
    var mbAttr = 'Map data &copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors, ' +
            'Imagery &copy <a href="https://mapbox.com">Mapbox</a>',
        mbUrl = 'https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpandmbXliNDBjZWd2M2x6bDk3c2ZtOTkifQ._QA7i5Mpkd_m30IGElHziw';
    
    var mbAttr2 = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
            'Imagery &copy <a href="https://opentopomap.org">OpenTopoMap</a>',
        mbUrl2 = 'http://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';

    var stravaUrl = 'https:globalheat.strava.com/tiles/{id}/color{color}/{z}/{x}/{y}.png',
        strvAttr = '<a href="https://www.strava.com/">Strava</a>';
        
    var googleUrl = 'https://mts{s}.google.com/vt/lyrs=s@186112443&hl=x-local&src=app&x={x}&y={y}&z={z}&s=Galile',
        googleAttr = '&copy; Google Maps';
        
    var lonviaUrl = 'https://tile.lonvia.de/hiking/{z}/{x}/{y}.png',
        lonviaAttr = '<a href="https://hiking.waymarkedtrails.org/">Lonvia</a>';
    
    var mapyCzUrl = "https://m{s}.mapserver.mapy.cz/wturist-m/{z}-{x}-{y}",
        mapyCzAttr = '&copy; <a href="https://www.seznam.cz/" target="_blank">Seznam.cz, a.s</a>'
    
    var opentopo = L.tileLayer(mbUrl2, {attribution: mbAttr2}),
        osm = L.tileLayer("http://a.tile.openstreetmap.org/{z}/{x}/{y}.png", {attribution: mbAttr2, errorTileUrl: "http://b.tile.openstreetmap.org/{z}/{x}/{y}.png"}),
        streets  = L.tileLayer(mbUrl, {id: 'mapbox.streets', attribution: mbAttr}),
        grayscale = L.tileLayer(mbUrl, {id: 'mapbox.light', attribution: mbAttr}),
        outdoors = L.tileLayer(mbUrl, {id: 'mapbox.outdoors', attribution: mbAttr}),
        satellite = L.tileLayer(mbUrl, {id: 'mapbox.satellite', attribution: mbAttr}),
        google = L.tileLayer(googleUrl, {
                subdomains: '0123',
                attribution: googleAttr,
                zIndex: 4
            }),
        mapyCz = L.tileLayer(mapyCzUrl, {
                subdomains: '1234',
                attribution: mapyCzAttr
            }),
            
        strava_overlay_b = L.tileLayer(stravaUrl, {zIndex: 2, id: 'running', color: '3', attribution: strvAttr}),
        strava_overlay_r = L.tileLayer(stravaUrl, {zIndex: 2, id: 'running', color: '1', attribution: strvAttr}),
        strava_bike_overlay = L.tileLayer(stravaUrl, {zIndex: 2, id: 'cycling', color: '3', attribution: strvAttr}),
        
        lonvia_overlay = L.tileLayer(lonviaUrl, {zIndex: 2, attribution: lonviaAttr}),
        mapyCz_overlay = L.tileLayer("https://m{s}.mapserver.mapy.cz/hybrid-trail_bike-m/{z}-{x}-{y}", {zIndex: 1, subdomains: '1234', attribution: lonviaAttr});
        hillshade_overlay = L.tileLayer("http://c.tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png", {zIndex: 10, opacity: 0.75, attribution: lonviaAttr});
        
        // Layer: https://github.com/liskin/strava-map-switcher/blob/master/layers.js#L22
        

    
    var map_init = 2;
    if (map_init == 1){
        map_layers = [streets, strava_overlay_b]
    } else{
        map_layers = [opentopo, strava_overlay_b, mapyCz_overlay]
    }

    var map = new L.map('map', {
        zoom: 12,
        fullscreenControl: true,
        fullscreenControlOptions: { // optional
            title:"Show me the fullscreen !",
            titleCancel:"Exit fullscreen mode"
        },
        editInOSMControlOptions: {position: 'bottomleft'},
        layers: map_layers
    });
    

    

    
    // var gpx = 'https://dl.dropboxusercontent.com/u/7621819/Grande_Sure.gpx'; // URL to your GPX file or the GPX itself
    // var gpx = 'https://dl.dropboxusercontent.com/u/7621819/Grande%20Lauziere.gpx';
    // var gpx = 'https://dl.dropboxusercontent.com/u/7621819/Soleil%20Levens.gpx';
    // var gpx = 'https://dl.dropboxusercontent.com/u/7621819/Tour%20verdon.gpx';
    {% if outputfile is not none %}
    var gpx = '{{outputfile}}'
    new L.GPX(gpx, {async: true,
        polyline_options: {color:'red', 
            opacity: 1
        },
        marker_options: {
            startIconUrl: '{{ url_for('static', filename='img/start.png') }}',
            endIconUrl: '{{ url_for('static', filename='img/end.png') }}',
            shadowUrl: '{{ url_for('static', filename='img/pin-shadow.png') }}',
            wptIconUrls: {
                'guidepost': '{{ url_for('static', filename='img/guidepost.png') }}',     
                'peak': '{{ url_for('static', filename='img/peak.png') }}',          
                'saddle': '{{ url_for('static', filename='img/saddle.png') }}',         
                'water': '{{ url_for('static', filename='img/water.png') }}',          
                'lake': '{{ url_for('static', filename='img/lake.png') }}',
                'glacier': '{{ url_for('static', filename='img/glacier.png') }}',      
                'alpine_hut': '{{ url_for('static', filename='img/alpine_hut.png') }}',            
                'wilderness_hut': '{{ url_for('static', filename='img/wilderness_hut.png') }}',              
                'viewpoint' : '{{ url_for('static', filename='img/viewpoint.png') }}',           
                'cave': '{{ url_for('static', filename='img/cave.png') }}'              
            },
            iconSize: [33, 50],
            popupAnchor:  [0, -40]
        }
    }).on('loaded', function(e) {
      map.fitBounds(e.target.getBounds());
      //document.getElementById("dist").innerHTML = e.target.get_distance() / 1000;
    }).addTo(map); 

    {% else %}
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


    var flickr = new L.Flickr('a06f677e097235ad98d9f0961d44252c',{maxLoad: 25, maxTotal: 250}); 

    var overlayMaps = {
        "Strava Run / Blue": strava_overlay_b,
        "Strava Run / Red": strava_overlay_r,
        "Strava Bike / Blue": strava_bike_overlay,
        "Lonvia": lonvia_overlay,
        "Mapy.cz": mapyCz_overlay,
        "Hillshade": hillshade_overlay,
        "Flickr" : flickr
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



</script>

<!-- <p id="dist"></p> -->

</body>
</html>
