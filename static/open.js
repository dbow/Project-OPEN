google.load('visualization', '1', {'packages':['table']});

var OP = {};

(function () {

var map;
var initial_bounds;

function changeData(update_map) {
  var whereClause = "";

  if (update_map) {
    map_bounds = map.getBounds();
    if (map_bounds) {
      whereClause = " WHERE ST_INTERSECTS('Address', RECTANGLE(LATLNG" + map_bounds.getSouthWest() + ", LATLNG" + map_bounds.getNorthEast() + "))";
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

function getData(response) {
  var table = new google.visualization.Table(document.getElementById('table'));
  options = {showRowNumber: true, maxHeight: 1000, width: 760}
  table.draw(response.getDataTable(), options);
  setHeights();
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

function setUpCategories(categories) {
}

function createMap(){
  var sf = new google.maps.LatLng(37.77493,-122.419416);

  map = new google.maps.Map(document.getElementById('map'), {
    center: sf,
    zoom: 12,
    mapTypeId: 'roadmap'
  });
  initial_bounds = map.getBounds();

  layer = new google.maps.FusionTablesLayer(652548);
  layer.setMap(map);
  setHeights();

  google.maps.event.addListener(map, 'bounds_changed', function() {
      changeData(true);
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
        console.log(initialLocation);
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

function hoverCat() {  /* haha (-danny) */
  if ($(this).hasClass("hover")) {
    $(this).removeClass("hover");
  }
  else {
    $(this).addClass("hover");
  }
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
    _tmpl = $("#table").template('table');
    
    $("#table").html('');
    
    me.getCache = function () {
        return _cache.getDataTable();
    };
    me.getTable = function () {
        return _table;
    };
    
    me.filter = function (cats) {
    	var html = '',
    		rows = _cache.table.rows,
    		catsKeyed = {},
    		i, j;
    
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
        
		//$("#table").html( $.tmpl('table', _cache.table.rows) );
        setHeights();
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
