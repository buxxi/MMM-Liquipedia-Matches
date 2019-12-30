# MMM-Liquipedia-Dota2
[Magic Mirror](https://magicmirror.builders/) Module - A module for Magic Mirror that displays live and upcoming Dota2 matches fetched from Liquipedia.

## Install
1. Clone repository into ``../modules/`` inside your MagicMirror folder.
2. Run ``npm install`` inside the ``MMM-Liquipedia-Dota2`` folder.
3. Add the module to the Magic Mirror config.
```
{
  module: "MMM-Liquipedia-Dota2",
  position: "top_left",
  header: "Upcoming Dota2 matches",
  config: {}
},
```
4. Done!

## Configuration parameters
- ``matchUpdateInterval`` : How often it should fetch new matches in seconds, anything lower than 30 minutes is throttled since it could lead to an ip-ban, default is 60 minutes.
- ``displayCount`` : the amount of matches to display, default is 5
- ``sourceUrl``: The API-url to use, could possibly be changed to other games on Liquipedia too?
- ``requiredProfiles``: the amount of teams in the match that needs to have a profile page on Liquipedia, 0-2, default is 0
