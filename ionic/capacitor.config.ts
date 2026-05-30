{
  "name": "geo-alarm",
  "appId": "com.geoalarm.app",
  "appName": "GPS Proximity Alarm",
  "webDir": "www",
  "bundledWebRuntime": false,
  "server": {
    "androidScheme": "https"
  },
  "plugins": {
    "@capacitor/geolocation": {
      "permissions": [
        "location"
      ]
    },
    "@capacitor/status-bar": {
      "style": "dark"
    }
  }
}
