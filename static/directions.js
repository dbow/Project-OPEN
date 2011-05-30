var map;
var directionsRenderer;
var geocoder;
var initial_bounds = null;
var origin_value;
var destination_value;

function geocodeValues(value, field) {

  var result = null;
  console.log(value);
  geocoder.geocode({'address': value,
                    'bounds': initial_bounds,
                    'region': 'US'}, function(results, status) {
     if (status == google.maps.GeocoderStatus.OK) { 
       if (field==1) {
         origin_value = results[0].geometry.location;
       }
       else {
         destination_value = results[0].geometry.location;
       }
       getDirections();
     } else {
       alert("Geocode was not successful for the following reason: " + status);
     }
   });
}

function setDirections(){
  directionsRenderer = new google.maps.DirectionsRenderer();
  var sf = new google.maps.LatLng(37.77493,-122.419416);
  map = new google.maps.Map(document.getElementById('directions-map'), {
    center: sf,
    zoom: 12,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
  });

  directionsRenderer.setMap(map);
  directionsRenderer.setPanel(document.getElementById('directions-list'));
  
  google.maps.event.addListener(map, 'bounds_changed', function() {
    initial_bounds = map.getBounds();
  });
}

function getDirections(){
  
  if (origin_value && destination_value) {
     directions = new google.maps.DirectionsService();
     directions.route( { 'origin': origin_value,
                      'destination': destination_value,
                      'travelMode': google.maps.DirectionsTravelMode.WALKING,
                    }, function(response, status) {
     if (status == google.maps.DirectionsStatus.OK) {
      directionsRenderer.setDirections(response);
     } else {
      alert("Directions request was not successful for the following reason: " + status);
    }
  }); 
  }

}

$(function () {

    geocoder = new google.maps.Geocoder();
    setDirections();
    geocodeValues($("#directions-form input")[0].value, 1);
    geocodeValues($("#directions-form input")[1].value, 2);

    $('#directions-form').submit(function() {
      geocodeValues($("#directions-form input")[0].value, 1);
      geocodeValues($("#directions-form input")[1].value, 2);
      return false;
    });
});
