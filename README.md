# Mountain GPX 
[www.mountaingpx.fr](http://www.mountaingpx.fr)

This web app aims at automatically adding waypoints (WPT) on a GPX route. These waypoints are particularly useful when following a route on a GPS watch device. Available waypoints come from:
- [openstreetmap.org](http://www.openstreetmap.org)
- [Strava segments](https://www.strava.com/segments/explore)

Example of a GPX track with the openstreetmap waypoints automatically hooked: 
![image1](https://raw.githubusercontent.com/krisanselmo/mountaingpx/master/static/img/presentation/2.png)
([See online demo](http://www.mountaingpx.fr/track/1))

Note: Only available in French for the moment

### Requirement for Strava segments
Get a [STRAVA API token](http://strava.github.io/api/) and replace the public access token in this file: [osm_wpt/private_values.py](osm_wpt/private_values.py)

### Usage

```bash
pip install -r requirements.txt
python mountaingpx_app.py
```
