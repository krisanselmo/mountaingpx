{% extends 'leaflet.tpl' %}

{% block javascript %}
<script src="https://unpkg.com/leaflet@1.0.2/dist/leaflet.js"></script>
<script src="{{ url_for('static', filename='Control.FullScreen.js') }}"></script>

<!-- <script src='//api.tiles.mapbox.com/mapbox.js/plugins/leaflet-omnivore/v0.3.1/leaflet-omnivore.min.js'></script> -->
<!--<script src='https://api.mapbox.com/mapbox.js/plugins/leaflet-omnivore/v0.2.0/leaflet-omnivore.min.js'></script>  -->
<script src="https://rawgithub.com/mpetazzoni/leaflet-gpx/master/gpx.js"></script>
<script src="{{ url_for('static', filename='Leaflet.EditInOSM.js') }}"></script> {# https://github.com/yohanboniface/Leaflet.EditInOSM #}
<script src="{{ url_for('static', filename='Flickr.js') }}"></script> {# https://github.com/shurshur/Leaflet.Flickr #}
{% endblock %}

