google.load('visualization', '1', {'packages':['table']});

var OP = {};

(function () {

var map;
var initial_bounds;
var sf;

function changeData(update_map) {
  var whereClause = "";

  if (update_map) {
    map_bounds = map.getBounds();
    if (map_bounds) {
      whereClause = " WHERE ST_INTERSECTS('Address', RECTANGLE(LATLNG" +
                    map_bounds.getSouthWest() +
                    ", LATLNG" + map_bounds.getNorthEast() + "))";
    }
  }
  
  var queryText = "SELECT 'Name of org','Sub-category','URL','Address','Services Provided','Other Info' FROM 652548" + whereClause;
  
  $.ajax({
  	url: 'http://www.google.com/fusiontables/api/query',
  	data: {sql: queryText},
  	dataType: 'jsonp',
  	jsonp: 'jsonCallback',
  	success: OP.Data.receive
  });
  
  //var query = new google.visualization.Query('http://www.google.com/fusiontables/gvizdata?tq='  + queryText);
  //query.send(OP.Data.receive);
}

function getCategoryList() {
  var queryText = encodeURIComponent("SELECT 'Sub-category' FROM 652548");
  var query = new google.visualization.Query('http://www.google.com/fusiontables/gvizdata?tq='  + queryText);
  query.send(parseList);
}

function parseList(response) {
  category_list = [];
  numRows = response.getDataTable().getNumberOfRows();
  for(i = 0; i < numRows; i++) {
      new_category = response.getDataTable().getValue(i, 0);
      if(category_list.indexOf(new_category) < 0) {
        category_list.push(new_category);
      }
  }
  final_list = []
  final_list.push({'cat': 'All'});
  for(i = 0; i < category_list.length; i++) {
      list_item = {'cat': category_list[i]};
      final_list.push(list_item);     
  }
  OP.Cats.populate(final_list);
}

function createMap(){

  var sf = new google.maps.LatLng(37.77493,-122.419416);

  map = new google.maps.Map(document.getElementById('map'), {
    center: sf,
    zoom: 12,
    mapTypeId: 'roadmap'
  });

  layer = new google.maps.FusionTablesLayer(652548);
  layer.setMap(map);
  setHeights();

  google.maps.event.addListener(map, 'bounds_changed', function() {
      changeData(true);

  if(!initial_bounds) {
    initial_bounds = map.getBounds();
  }

  });
}


function updateMap(location) {
  if (location == "Current location") {
    // Try W3C Geolocation (Preferred)
    if(navigator.geolocation) {
      browserSupportFlag = true;
      navigator.geolocation.getCurrentPosition(function(position) {
        initialLocation = new google.maps.LatLng(position.coords.latitude,position.coords.longitude);
        map.setCenter(initialLocation);
      }, function() {
        handleNoGeolocation(browserSupportFlag);
      });
    }
    // Browser doesn't support Geolocation
    else {
      browserSupportFlag = false;
      handleNoGeolocation(browserSupportFlag);
    }
  }
  else {
    geocoder = new google.maps.Geocoder();

    geocoder.geocode( { 'address': location,
                        'bounds': initial_bounds,
                        'region': 'US',
                        }, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        map.setCenter(results[0].geometry.location);
        var marker = new google.maps.Marker({
            map: map, 
            position: results[0].geometry.location
        });
      } else {
        alert("Geocode was not successful for the following reason: " + status);
      }
    }); 
  }
  function handleNoGeolocation(errorFlag) {
    if (errorFlag == true) {
      alert("Geolocation service failed.");
      initialLocation = sf;
    } else {
      alert("Your browser doesn't support geolocation.");
      initialLocation = sf;
    }
    map.setCenter(initialLocation);
  }
}

$('#location').submit(function() {
  updateMap($("#location-form input:first").val());
  return false;
});


OP.performSearch = function() {
  changeData();
}

function setHeights() {
    $("#rail").css('minHeight', $("#content").height() - 20);
}

OP.Cats = (function () {
    var me = {},
    
    // functions
    _click,
    
    // data
    _selected = {};
    
    me.populate = function (categories) {
        /* 	var categories = [
    	   {cat: 'All'},
    	   {cat: 'Housing / Shelter'},
    	   {cat: 'AIDS Treatment / Prevention'},
    	]; */
    	
    	var cats = $("#cats"),
            tmpl = cats.html();
        
        cats.html('');
    	$.tmpl(tmpl, categories).click(_click).appendTo("#cats");
    	setHeights();
    };
    
    _click = function () {
        var el = $(this);
        
        if (el.html() === 'All') {
            el.siblings().removeClass('on');
            _selected = {};
        }
        else if (el.hasClass('on')) {
            el.removeClass('on');
            delete _selected[el.html()];
        }
        else {
            $(this).addClass('on');
            _selected[el.html()] = 1;
        }
        
        OP.Data.filter(OP.Util.toArrayKeys(_selected));
        //changeData(OP.Util.toArrayKeys(_selected));
    };
    
    return me;
}());

OP.Data = (function () {
    var me = {},
    
    // data
    _cache,
    _table,
    _tmpl = $("#table").template('table'),
    _filtered = [];
    
    $("#table").html('');
    
    me.getCache = function () {
        return _cache.getDataTable();
    };
    me.getTable = function () {
        return _table;
    };
    
    me.getFiltered = function () {
    	return _filtered;
    };
    
    me.filter = function (cats) {
    	var html = '',
    		rows = _cache.table.rows,
    		catsKeyed = {},
    		i, j;
    		
    	_filtered = [];
    
        if (cats && cats.length) {
        	for (i = 0; i < cats.length; i++) {
        		catsKeyed[cats[i]] = 1;
        	}
        }
        else {
        	cats = null;
        }
        
        //var geocoder = new google.maps.Geocoder();
        //var bounds = new google.maps.LatLngBounds();
        for (var i in rows) {
          if ($('#search-box').val()) {
            var searchRegex = new RegExp($('#search-box').val(), 'i');
            var rowMatches = false;
            for (var field = 0; field < 6; field++) {
              if (searchRegex.test(rows[i][field])) {
                rowMatches = true;
              }
            }
            if (!rowMatches) {
              continue;
            }
          }
        	if (!cats || catsKeyed[rows[i][1]]) {
        		_filtered.push(rows[i]);
            //console.log('looking at address: ' + rows[i][3]);
            //geocoder.geocode(
            //    {'address': rows[i][3]},
            //    function(results, status) {
            //      if (status == google.maps.GeocoderStatus.OK) {
            //        console.log('extending bounds to include: ' + rows[i][3]);
            //        bounds.union(results[0].geometry.viewport);
            //      } else {
            //        console.log("Address not found: " + rows[i][3]);
            //      }
            //    });
	        	html += '<div class="row clearfix">' +
	        		'<div class="cell name"><a target="_blank" href="'+ rows[i][2] +'">' + rows[i][0] + '</a></div>' +
	        		'<div class="cell address">' + rows[i][3] + '</div>' +
	        		'<div class="cell services">' + rows[i][4] + '</div>' +
	        		'<div class="cell info">' + rows[i][5] + '</div>' +
	        		'<div class="cell directions"><button>Directions</button></div>' +
	        		'<div class="cell directions-menu"><form action="/directions" id="directions-form">' +
	        		  '<p>From: </p><input type="text" name="origin" value="" />' +
								'<p>To: </p><input type="text" name="destination" value="' + rows[i][3] + '" />' +
								'<input type="submit" value="Get Directions"></form></div>' +
	        		//'<div class="cell name"><a target="_blank" href="'+ rows[i][2] +'">' + rows[i][0] + '</a></div>' +
	        	'</div>';
        	}
        }
        
        //map.fitBounds(bounds);

        $("#table").html(html);
        
        $("#table .name a").hover(function () {
        	$(this).parent().siblings('.info').fadeIn();
       	}, function () {
       		$(this).parent().siblings('.info').stop(true, true).fadeOut();
       	});
       	
       	$("#table .directions").click(function () {
       	  var dir_menu = $(this).siblings('.directions-menu');
       	  if (dir_menu.hasClass("invisible")) {
       	    dir_menu.removeClass("invisible");
       	  }
       	  else {
       	    dir_menu.addClass("invisible");
       	  }
       	});
       	$("#table .directions").click(function () {
       	  if($(this).data('displayed')) {
       	    $(this).siblings('.directions-menu').fadeOut();
       	    $(this).data('displayed', false);
       	  }
       	  else {
       	    $(this).siblings('.directions-menu').fadeIn();
       	    $(this).data('displayed', true);
       	  }
        }); 
        
		//$("#table").html( $.tmpl('table', _cache.table.rows) );
        setHeights();
    };
    
    me.print = function () {
    	var win = window.open('', 'Print'),
    		doc = win.document,
    		img = new Image(),
    		params,
    		markers = [];

		doc.write('<html><head><title>Print</title></head><body></body></html>');
		$("#map .gmnoprint").hide();
		doc.body.innerHTML = '<div style="position: relative; height: 250px; width: 760px;">' + $("#map").html() + '</div>' + $("#table").html();
		$("#map .gmnoprint").show();
		
		//not doing static maps
		/*
for (var i in _filtered) {
			markers.push('hi');
		}
		
		params = {
			center: map.getCenter().toUrlValue(),
			zoom: map.getZoom(),
			maptype: 'roadmap',
			sensor: 'false',
			size: '760x250',
			markers: markers.join('|')
		};
		
		img.src = 'http://maps.google.com/maps/api/staticmap?center=Brooklyn+Bridge,New+York,NY&zoom=14&size=512x512&maptype=roadmap&markers=color:blue%7Clabel:S%7C40.702147,-74.015794&markers=color:green%7Clabel:G%7C40.711614,-74.012318&markers=color:red%7Ccolor:red%7Clabel:C%7C40.718217,-73.998284&sensor=false';
		
		img.src = 'http://maps.google.com/maps/api/staticmap?' + $.param(params);

		doc.body.insertBefore(img, doc.body.childNodes[0]);
*/
		
    };
    
    me.receive = function (response) {
        _cache = response;
        me.filter();
    };
    
    return me;
}());

OP.Util = (function () {
    var me = {};
    
    me.toArrayKeys = function (obj) {
        var arr = [];
    
        for (var i in obj) {
            arr.push(i);
        }
        
        return arr;
    };
    
    return me;
}());

$(function () {
    createMap();
    getCategoryList();
    setHeights();
});

}());
