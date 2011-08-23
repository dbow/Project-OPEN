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
  final_list = [];
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
            tmpl = cats.html(),
            table = $('<table/>'),
            row = $('<tr/>').appendTo(table);
        
        //cats.html('');
        
        for (var i = 0, j = 0; i < categories.length; i++) {
        	if (j > 4) {
        		row = $('<tr/>').appendTo(table);
        		j = 0;
        	}
        	
        	row.append(
        		'<td class="cat"><div class="cat-box"></div>' + categories[i].cat + '</td>'
        	);
        	j++;
        }
        
    	//$.tmpl(tmpl, categories).click(_click).appendTo("#cats");
    	cats.append(table).delegate('.cat', 'click', _click);
    	setHeights();
    };
    
    _click = function () {
        var el = $(this);
        
        if (el.text() === 'All') {
            $("#cats table .cat").removeClass('on');
            el.addClass('on');
            _selected = {};
        }
        else if (el.hasClass('on')) {
            el.removeClass('on');
            delete _selected[el.text()];
        }
        else {
            $(this).addClass('on');
            $("#cats .cat-all").removeClass('on');
            _selected[el.text()] = 1;
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
    		table = $("#table").html(''),
    		row,
    		rows = _cache.table.rows,
    		catsKeyed = {},
    		i, j,
    		search = $("#search-box");
    		
    	console.log(cats);
    		
    	_filtered = [];
    
        if (cats && cats.length) {
        	for (i = 0; i < cats.length; i++) {
        		catsKeyed[cats[i]] = 1;
        	}
        }
        else {
        	cats = null;
        }
        
        table.hide();
        
        //var geocoder = new google.maps.Geocoder();
        //var bounds = new google.maps.LatLngBounds();
        for (var i in rows) {
          if (search.val() && search.val() !== search.attr('title')) {
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
	        	row = $(
	        	'<div class="row clearfix">' +
	        		'<div class="clearfix">' +
	        			'<span class="ui-button ui-button-add"><span></span>Add to My Guide</span>' +
		        		'<img class="table-img" />' +
		        		'<div class="table-cells">' +
			        		'<div class="cell table-name DIN-bold"><a target="_blank" href="'+ rows[i][2] +'">' + rows[i][0] + '</a></div>' +
			        		'<div class="cell table-services">' + rows[i][4] + '</div>' +
			        		'<div class="cell table-address">' + rows[i][3] + '</div>' +
			        		'<div class="cell table-link"><a target="_blank" href="'+ rows[i][2] +'">' + rows[i][2] + '</a></div>' +
			        		'<div class="table-toggle">More Information</div>' +
		        		'</div>' +
	        		'</div>' +
	        		'<div class="table-more" style="display: none;">' +
	        			'<div class="cell table-info">' + rows[i][5] + '</div>' +
	        		'</div>' +
	        		/*
'<div class="cell directions"><button>Directions</button></div>' +
	        		'<div class="cell directions-menu"><form action="/directions" id="directions-form">' +
	        		  '<p>From: </p><input type="text" name="origin" value="" />' +
								'<p>To: </p><input type="text" name="destination" value="' + rows[i][3] + '" />' +
								'<input type="submit" value="Get Directions"></form></div>' +
*/
	        		//'<div class="cell name"><a target="_blank" href="'+ rows[i][2] +'">' + rows[i][0] + '</a></div>' +
	        	'</div>'
	        	).data('id', i).appendTo(table);
        	}
        }
        
        //map.fitBounds(bounds);

        $("#table").show();
        
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

OP.MyGuide = (function () {
	var me = {},
		_current = {},
		_guides = {};
		
	function _clickAdd() {
		var el = $(this),
    		id = el.parents('.row').data('id'),
    		div;
    		
    	if (_current[id]) {
    		return;
    	}
    		
    	_current[id] = true;
    	
    	console.log(_current);
    	
    	div = $(
    		'<div class="rail-guide-entry">' +
    			'<div class="rail-guide-entry-x">x</div>' +
    			el.siblings('.table-cells').html() +
    		'</div>'
    	).data('id', id);
    	
    	$('.rail-guide-empty').hide();
    	$('.rail-guide-added-box').append(div);
	}
	
	function _clickRemove() {
		var el = $(this).parent(),
			id = el.data('id');
	
		el.fadeOut(function () {
			el.remove();
		});
		
		delete _current[id];
	}
	
	function _save(callback) {
		var hash,
			arr = OP.Util.toArrayKeys(_current);
		
		arr.sort();
		hash = arr.join('_');
		
		hash = Crypto.SHA1(hash);
		
		callback(hash);
	}
	
	function _link(hash) {
		
	}
	me.link = function () {
		_save(_link);
	};
	
	me.setUp = function () {
		//set up table adder
        $("#table").delegate('.ui-button', 'click', _clickAdd);
        $('.rail-guide-added-box').delegate('.rail-guide-entry-x', 'click', _clickRemove);
	};
	
	return me;
}());

OP.Util = (function () {
    var me = {};
    
    // set up default functionallity
    me.setUp = function () {
    	//set up search inputs
    	$('.ui-off').each(function() {
    		$(this).val($(this).attr('title'));
    	}).live('focus', function () {
    		var el = $(this);
    		el.removeClass('ui-off').addClass('ui-on');
    		
    		if (el.val() === el.attr('title')) {
    			el.val('');
    		}
    	});
    	
    	$('.ui-on').live('blur', function () {
    		var el = $(this);
    		
    		if (!el.val()) {
    			el.val(el.attr('title'));
    		}
    		
    		el.addClass('ui-off').removeClass('ui-on');
    	});
    	
    	//set up categories toggler
    	$('.filters-toggle').toggle(function () {
    		$(this).text('Show Filters').addClass('ui-off');
    		$('#cats').slideUp();
    	}, function () {
    		$(this).text('Hide Filters').removeClass('ui-off');
    		$('#cats').slideDown();
    	});
    	
    	//set up table toggler
    	$("#table").delegate('.table-toggle', 'click', function () {
        	var el = $(this);
        	if (el.text() === 'More Information') {
        		el.text('Less Information');
        		el.parent().parent().siblings().slideDown();
        	}
        	else {
        		el.text('More Information');
        		el.parent().parent().siblings().slideUp();
        	}
        });
        
        //set up rail toggler
        $(".rail-hide").click(function () {
        	$("#page").addClass('page-wide');
        });
        $(".rail-show").click(function () {
        	$("#page").removeClass('page-wide');
        });
        
        //set up table hide/show
        $("#table .directions").live('click', function () {
       	  var dir_menu = $(this).siblings('.directions-menu');
       	  if (dir_menu.hasClass("invisible")) {
       	    dir_menu.removeClass("invisible");
       	  }
       	  else {
       	    dir_menu.addClass("invisible");
       	  }
       	});
       	$("#table .directions").live('click', function () {
       	  if($(this).data('displayed')) {
       	    $(this).siblings('.directions-menu').fadeOut();
       	    $(this).data('displayed', false);
       	  }
       	  else {
       	    $(this).siblings('.directions-menu').fadeIn();
       	    $(this).data('displayed', true);
       	  }
        }); 
        
        OP.MyGuide.setUp();
    };
    
    me.toArrayKeys = function (obj) {
        var arr = [];
    
        for (var i in obj) {
            arr.push(i);
        }
        
        return arr;
    };
    
    me.copyInside = function (inElement) {
	  if (inElement.createTextRange) {
	    var range = inElement.createTextRange();
	    if (range && BodyLoaded==1)
	      range.execCommand('Copy');
	  } else {
	    me.copy(inElement.value);
	  }
	}
	
	 me.copy = function (text) {
	    var flashcopier = 'flashcopier';
	    if(!document.getElementById(flashcopier)) {
	      var divholder = document.createElement('div');
	      divholder.id = flashcopier;
	      document.body.appendChild(divholder);
	    }
	    document.getElementById(flashcopier).innerHTML = '';
	    var divinfo = '<embed src="/static/_clipboard.swf" FlashVars="clipboard='+encodeURIComponent(text)+'" width="0" height="0" type="application/x-shockwave-flash"></embed>';
	    document.getElementById(flashcopier).innerHTML = divinfo;
	}
    
    return me;
}());

$(function () {
	OP.Util.setUp();
    createMap();
    getCategoryList();
    setHeights();
});

}());
