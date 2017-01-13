{# http://jinja.pocoo.org/docs/dev/templates/ #}


<!DOCTYPE html>
<html>
<head>
    <title>Mountain GPX</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    {# -- CSS -- #}
    <link rel="shortcut icon" href={{ url_for('static', filename='favicon.ico') }}/>
    

</head>
<body>

<h1>Help page</h1>


<h3>Open Topo Map</h3>
Le projet <a href='https://github.com/der-stefan/OpenTopoMap'>Github</a>



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


</body>
</html>
