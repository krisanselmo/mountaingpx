
initMap: function() {


        // TILES 

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
        
    var lonviaUrl = 'http://tile.lonvia.de/hiking/{z}/{x}/{y}.png',
        lonviaAttr = '<a href="http://hiking.waymarkedtrails.org/">Lonvia</a>',
        lonvia_overlay = L.tileLayer(lonviaUrl, {
            zIndex: 2, 
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
        
        // Layer: https://github.com/liskin/strava-map-switcher/blob/master/layers.js#L22
        
};