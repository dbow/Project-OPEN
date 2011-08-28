google.load('visualization', '1', {'packages':['table']});

var OP = {};

(function () {

OP.SITE_ROOT = 'http://project-open.appspot.com';

var map;
var initial_bounds;
var sf;
var FUSION_ID = 1293272;
var WIKI_URL = 'sfhomeless.wikia.com/wiki/';
var parentCategories = [];

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
  
  var queryText = "SELECT 'Name','ID','Website','Address','Categories','Summary','Image','Wiki URL','DisplayFilter','FilterCategories' FROM " + FUSION_ID + whereClause;
  
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
  for(var prop in categoryMapping) {
    parentCategories.push(prop);
  }
  var categoryList = [];
  for(i=0; i < parentCategories.length; i++) {
    list_item = {'cat': parentCategories[i]};
    categoryList.push(list_item);
  }
  OP.Cats.populate(categoryList);
}


function createMap(){

  var sf = new google.maps.LatLng(37.77493,-122.419416);

  map = new google.maps.Map(document.getElementById('map'), {
    center: sf,
    zoom: 12,
    mapTypeId: 'roadmap',
    scrollwheel: false
  });

  layer = new google.maps.FusionTablesLayer({
    query: {
      select: 'Address',
      from: FUSION_ID
    },
    styles: [{
      markerOptions: {
        iconName: "small_yellow"
      }
    }, {
      where: "'Filter Category' = 'Housing'",
      markerOptions: {
        iconName: "small_blue"
      }
    }]
  });
  layer.setMap(map);

    // add a click listener to the layer, so we can customize the info window
    // when it's displayed.
    // TODO(atm): Make this look good.
    // TODO(atm): Large summaries can overrun the height of the info window. We
    // need to adjust the size of the window to suit.
    google.maps.event.addListener(layer, 'click', function(e) {
      //update the content of the InfoWindow
      e.infoWindowHtml = '<div style="color:#e4542e; font-size:18pt">' + e.row['Name'].value + '</div>';
      if (e.row['Summary'].value != 'None') {
        e.infoWindowHtml += '<div style="font-style:italic; font-size:12pt">';
        e.infoWindowHtml += e.row['Summary'].value;
        e.infoWindowHtml += '</div>';
      }
      if (e.row['Address'].value != 'None' ||
          e.row['Phone'].value != 'None' ||
          e.row['Hours'].value != 'None') {
        e.infoWindowHtml += '<div style="font-style:italic; font-size:12pt">';
        if (e.row['Address'].value != 'None') {
          e.infoWindowHtml += e.row['Address'].value + '</br>';
        }
        if (e.row['Phone'].value != 'None') {
          e.infoWindowHtml += e.row['Phone'].value + '</br>';
        }
        if (e.row['Hours'].value != 'None') {
          e.infoWindowHtml += e.row['Hours'].value;
        }
        e.infoWindowHtml += '</div>';
      }
    });


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
          var inCategory = false;
          var filteredCats = rows[i][9].split(', ');
          var filteredLen = filteredCats.length;
          for (i = 0; i < filteredLen; i++) {
            if(catsKeyed[filteredCats[i]]) {
              inCategory = true;
            }
          }
        	if (!cats || inCategory) {
        	  console.log(filteredCats);
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
            var catValues = rows[i][4]
            var websiteContent = '';
            if (rows[i][2] != 'None') {
              websiteContent = '<div class="cell table-link"><a target="_blank" href="'+ rows[i][2] +'">' + rows[i][2] + '</a></div>';
            }
            var summaryInfo = '';
            var showMoreInfo = '';
            if (rows[i][5] != 'None') {
              summaryInfo = '<div class="table-more" style="display: none;">' +
	        			'<div class="cell table-info">' + rows[i][5] + '</div>' +
	        		'</div>';
              showMoreInfo = '<div class="table-toggle">More Information</div>';
            }
            var imageInfo = '<img class="table-img" src="/image?filter=' + rows[i][8] + '"/>';
            if (rows[i][6] == 'True') {
              imageInfo = '<img class="table-img" src="/image?wikiurl=' + rows[i][7] + '" />';
            }
	        	row = $(
	        	'<div class="row clearfix" id="' + rows[i][1] + '">' +
	        		'<div class="clearfix">' +
	        			'<span class="ui-button ui-button-add"><span></span>Add to My Guide</span>' +
		        		imageInfo +
		        		'<div class="table-cells">' +
			        		'<div class="cell table-name DIN-bold"><a target="_blank" href="'+ WIKI_URL + rows[i][7] +'">' + rows[i][0] + '</a></div>' +
			        		'<div class="cell table-services">' + catValues + '</div>' +
			        		'<div class="cell table-address">' + rows[i][3] + '</div>' +
			        		websiteContent +
			        		showMoreInfo +
		        		'</div>' +
	        		'</div>' +
	        		summaryInfo +
	        		/*
'<div class="cell directions"><button>Directions</button></div>' +
	        		'<div class="cell directions-menu"><form action="/directions" id="directions-form">' +
	        		  '<p>From: </p><input type="text" name="origin" value="" />' +
								'<p>To: </p><input type="text" name="destination" value="' + rows[i][3] + '" />' +
								'<input type="submit" value="Get Directions"></form></div>' +
*/
	        		//'<div class="cell name"><a target="_blank" href="'+ rows[i][2] +'">' + rows[i][0] + '</a></div>' +
	        	'</div>'
	        	).data('id', rows[i][1]).appendTo(table);
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
    		
    	console.log('hi');

		doc.write('<html><head><title>Print<link type="text/css" rel="stylesheet" href="/static/global.css" /><link type="text/css" rel="stylesheet" href="/static/map.css" /></title></head><body></body></html>');
		doc.body.innerHTML = '<div style="position: relative; height: 1250px; width: 1000px;">' + $("#map").html() + '</div><div class="resources">' + $(".resources").html() + '</div>';
		
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
	
	me.save = function (callback) {
		var hash,
			arr = OP.Util.toArrayKeys(_current);
			
		if (!arr.length) {
			return alert('You have no services in your map.');
		}
		
		$.post('/save', {ids: arr}, function (data) {
			_guides[data] = arr;
			callback(data, arr);
		}, 'json');
	};
	
	me.url = function (hash) {
		return OP.SITE_ROOT + '/map?id=' + hash
	};
	
	me.link2 = function (hash) {
		alert(me.url(hash));
	}
	me.link = function () {
		me.save(me.link2);
	};
	
	me.email2 = function (hash) {
		window.location = 'mailto:?subject=projectOPEN Map&body=' + me.url(hash);
	};
	me.email = function () {
		me.save(me.email2);
	};
	
	me.print = function () {
		me.save(function (hash) {
			window.open(me.url(hash));
		});
	};
	
	me.setUp = function () {
		//set up table adder
        $("#table").delegate('.ui-button', 'click', _clickAdd);
        $('.rail-guide-added-box').delegate('.rail-guide-entry-x', 'click', _clickRemove);
        
        $('.rail-option-link').click(me.link);
        $('.rail-option-email').click(me.email);
        $('.rail-option-print').click(me.print);
	};
	
	return me;
}());

OP.Map = (function () {
	var me = {},
		_hash;
	
	me.print = function () {
		$('body').addClass('print');
		window.print();
		$('body').removeClass('print');
	};
	
	me.email = function () {
		OP.MyGuide.email2(_hash);
	};
	
	me.link = function () {
		OP.MyGuide.link2(_hash);
	};
	
	me.createNew = function () {
		var sf = new google.maps.LatLng(37.77493,-122.419416);

		map = new google.maps.Map(document.getElementById('map'), {
			center: sf,
			zoom: 12,
			mapTypeId: 'roadmap',
			scrollwheel: false
		});
		
		layer = new google.maps.FusionTablesLayer(FUSION_ID);
		layer.setMap(map);
		setHeights();
		
		google.maps.event.addListener(map, 'bounds_changed', function() {
			changeData(true);
		
			if(!initial_bounds) {
				initial_bounds = map.getBounds();
			}
		
		});
	};
	
	me.createStatic = function (data) {
		_hash = data.url;
	
		var sf = new google.maps.LatLng(37.77493,-122.419416);

		var map = new google.maps.Map(document.getElementById('map'), {
				center: sf,
				zoom: 13,
				disableDefaultUI: true,
				draggable: false,
				mapTypeId: 'roadmap',
				scrollwheel: false
			}),
			
			ids = data.ids.join(',');	
		
		layer = new google.maps.FusionTablesLayer({
			query: {
				select: 'Address',
				from: FUSION_ID,
				where: 'ID IN (' + ids + ')'
			}
		});
		
		layer.setMap(map);
	};
	
	me.setUp = function () {
		$('.header-sub-option-print').click(me.print);
		$('.header-sub-option-link').click(me.link);
		$('.header-sub-option-email').click(me.email);
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
        		el.text('Less Information').addClass('ui-off');
        		el.parent().parent().siblings().slideDown();
        	}
        	else {
        		el.text('More Information').removeClass('ui-off');
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
	if (location.pathname === '/map') {
		console.log('hi');
		OP.Map.setUp();
	}
	else {
		OP.Util.setUp();
	    createMap();
	    getCategoryList();
	    setHeights();
    }
});

}());
