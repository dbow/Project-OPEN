var OP = {};

(function () {

OP.SITE_ROOT = location.protocol + '//' + location.host; //location.origin; //'http://project-open.appspot.com';
OP.WIKI_URL = 'http://sfhomeless.wikia.com/wiki/';
OP.FUSION_ID = 1293272;

var map;
var initialBounds;
var sf_latlng = new google.maps.LatLng(37.77493,-122.419416);

OP.FusionMap = (function () {

    var me = {},
      layer,
		  _targetLocation,
		  _listener;
    
    me.changeData = function () {

      var whereClause = "";

      var mapBounds = map.getBounds();
      if (mapBounds) {
        whereClause += " WHERE ST_INTERSECTS('Address', RECTANGLE(LATLNG" +
                       mapBounds.getSouthWest() +
                       ", LATLNG" + mapBounds.getNorthEast() + "))";
      }
  
      var queryText = "SELECT " +
                      "'Name','ID','Website','Address','Categories','Summary'," +
                      "'Image','Wiki URL','DisplayFilter','FilterCategories' " +
                      "FROM " + OP.FUSION_ID + whereClause;
      $.ajax({
      	url: 'http://www.google.com/fusiontables/api/query',
      	data: {sql: queryText},
      	dataType: 'jsonp',
      	jsonp: 'jsonCallback',
      	success: OP.Data.receive
      });
    };
    
    me.createMap = function () {

      map = new google.maps.Map(document.getElementById('map'), {
        center: sf_latlng,
        zoom: 12,
        mapTypeId: 'roadmap',
        scrollwheel: false
      });

      me.updateLayer('all');

      OP.Util.setHeights();

      google.maps.event.addListener(map, 'idle', function() {
        me.changeData();
        if(!initialBounds) {
          initialBounds = map.getBounds();
        }
      });
      
    };
    
    me.updateLayer = function (ids) {

      var queryParams = {
        select: 'Address',
        from: OP.FUSION_ID,
      };
      if (ids != 'all') {
        var idString = '0';
        if (ids.length) {
          // Very broad queries can generate URIs that are too large
          // so only the first ~160 or so IDs are submitted.
          // TODO(dbow): Figure out a better solution for this.
          if (ids.length > 170) {
            ids = ids.slice(0,169);
          }
          idString = ids.join(',');
        }
        var whereString = 'ID IN (' + idString + ')';     
        queryParams.where = whereString;
      }
      if (layer) {
        layer.setMap(null);
      }
      layer = new google.maps.FusionTablesLayer({
        query: queryParams,
        // FusionTablesLayer only supports up to 5 custom styles...
        styles: [{
          markerOptions: {
            iconName: "measle_white"
          }
        }, {
          where: "'DisplayFilter' = 'Employment'",
          markerOptions: {
            iconName: "small_blue"
          }
        }, {
          where: "'DisplayFilter' = 'Housing'",
          markerOptions: {
            iconName: "measle_brown"
          }
        }, {
          where: "'DisplayFilter' = 'Legal'",
          markerOptions: {
            iconName: "small_purple"
          }
        }, {
          where: "'DisplayFilter' = 'Medical'",
          markerOptions: {
            iconName: "small_red"
          }
        }]
      });
      me.stylizeLayer(layer);
      layer.setMap(map);
    };
    
    me.stylizeLayer = function (layer) {

      // add a click listener to the layer, so we can customize the info window
      // when it's displayed.
      _listener = google.maps.event.addListener(layer, 'click', function(e) {

        //update the content of the InfoWindow
        e.infoWindowHtml = '<div style="color:#e4542e; font-size:18px">' +
                           e.row['Name'].value + '</div>';
        if (e.row['Categories'].value != 'None') {
          e.infoWindowHtml += '<div class="table-services">' +
                               e.row['Categories'].value + '</br></div>';
        }
        if (e.row['Address'].value != 'None' ||
            e.row['Phone'].value != 'None' ||
            e.row['Hours'].value != 'None') {
          e.infoWindowHtml += '<div class="table-address">';
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
    };
    
    me.updateMap = function (location) {
      
      if (location == "Current location") {
        var browserSupportFlag = false;
        // Try W3C Geolocation (Preferred)
        if(navigator.geolocation) {
          browserSupportFlag = true;
          navigator.geolocation.getCurrentPosition(function(position) {
            _targetLocation = new google.maps.LatLng(position.coords.latitude,
                                                     position.coords.longitude);
            map.setCenter(_targetLocation);
          }, function() {
            me.handleNoGeolocation(browserSupportFlag);
          });
        }
        // Browser doesn't support Geolocation
        else {
          me.handleNoGeolocation(browserSupportFlag);
        }
      }
      else {
        geocoder = new google.maps.Geocoder();

        geocoder.geocode( { 'address': location,
                            'bounds': initialBounds,
                            'region': 'US',
                            }, function(results, status) {
          if (status == google.maps.GeocoderStatus.OK) {
            map.setCenter(results[0].geometry.location);
            var marker = new google.maps.Marker({
                map: map, 
                position: results[0].geometry.location
            });
          } else {
            alert("We could not determine the location of the provided address." +
                  "Please try again!");
            console.log("Geocode was not successful for the following reason: " +
                        status);
          }
        }); 
      }      
    };
    
    me.handleNoGeolocation = function (errorFlag) {
      if (errorFlag == true) {
        console.log("Geolocation service failed.");
      } else {
        console.log("Your browser doesn't support geolocation.");
      }
      _targetLocation = sf_latlng;
      alert("We could not determine your location :( " +
            "Please provide a specific address.");
      map.setCenter(_targetLocation);
    };
    
    me.setUp = function () {
      me.createMap();
      $('#location').submit(function() {
        me.updateMap($("#location-form input:first").val());
        return false;
      });
    };

    return me;

}());


OP.Cats = (function () {
    var me = {},
    
    // functions
    _click,
    
    // data
    _selected = {};
    
    me.getSelected = function () {
      return _selected;
    };
    
    me.retrieve = function () {
      var parentCategories = [];
      for(var prop in OP.categoryMapping) {
        parentCategories.push(prop);
      }
      var categoryList = [];
      var catLen = parentCategories.length;
      for(i=0; i < catLen; i++) {
        var listItem = {'cat': parentCategories[i]};
        categoryList.push(listItem);
      }
      me.populate(categoryList);
    };
    
    me.populate = function (categories) {
    	
    	var cats = $("#cats"),
            tmpl = cats.html(),
            table = $('<table/>'),
            row = $('<tr/>').appendTo(table);
        
        for (var i = 0, j = 0; i < categories.length; i++) {
        	if (j > 4) {
        		row = $('<tr/>').appendTo(table);
        		j = 0;
        	}
        	
        	row.append(
        		'<td class="cat"><div class="cat-box"></div>' +
        		categories[i].cat + '</td>'
        	);
        	j++;
        }
        
    	//$.tmpl(tmpl, categories).click(_click).appendTo("#cats");
    	cats.append(table).delegate('.cat', 'click', _click);
    	OP.Util.setHeights();
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
        
        OP.Data.filter();
    };
    
    return me;
}());


OP.Data = (function () {
    var me = {},
    
    _cache, // The fusion table query data (rows within the map bounds, before filtering)
    _table = $("#table").html(''),
    _tmpl = $("#table").template('table'),
    _filtered = [], // The rows returned after category filtering
    _results = [], // The rows returned after both category and search filtering
    _ids = []; // The IDs of the _results rows.
    
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
    me.getResults = function () {
    	return _results;
    };
    
    me.performSearch = function () {

      var rows = _filtered,
          search = $("#search-box"),
          _table = $("#table").html(''),
          _ids = [],
          searchPerformed = false,
          searchQuery = search.val();

      if (_results.length) {
        _results = [];
      }

      if (searchQuery && searchQuery !== search.attr('title')) {
        searchPerformed = true;
      }
      for (var i in rows) {
        var rowMatches = false;
        if (searchPerformed) {
          var searchRegex = new RegExp($('#search-box').val(), 'i');
          for (var field = 0; field < 6; field++) {
            if (searchRegex.test(rows[i][field])) {
              rowMatches = true;
            }
          }
        }
        if (rowMatches || !searchPerformed) {
            _results.push(rows[i]);
        		me.buildRow(rows[i]);
        		_ids.push(rows[i][1]);
        }
      }
      
      $("#table").show();
      OP.Util.setHeights();
      if (_results.length == _cache.table.rows.length) {
        _ids = 'all';
      }

      OP.FusionMap.updateLayer(_ids);
    };
    
    me.filter = function () {
    	var rows = _cache.table.rows,
    	  cats = OP.Util.toArrayKeys(OP.Cats.getSelected()),
    		_table = $("#table").html(''),
    		catsKeyed = {};
    		
    		if (_filtered.length) {
    		  _filtered = [];
    		}
    
        if (cats && cats.length) {
        	for (i = 0; i < cats.length; i++) {
        	  catsKeyed[cats[i]] = 1;
        	}
        } else {
        	cats = null;
        }
        
        _table.hide();
        
        /*
          TODO(dbow): If we decide to have search results dictate the bounds of
          the map, we'll need to uncomment and complete the code in the sections below.
        */

        //var geocoder = new google.maps.Geocoder();
        //var bounds = new google.maps.LatLngBounds();
        for (var i in rows) {
          var inCategory = false;
          var filteredCats = rows[i][9].split(', ');
          var filteredLen = filteredCats.length;
          for (var j = 0; j < filteredLen; j++) {
            if(catsKeyed[filteredCats[j]]) {
              inCategory = true;
            }
          }
        	if (!cats || inCategory) {
        		
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
        	}
        }
        
        me.performSearch();
        
        //map.fitBounds(bounds);
        
		//$("#table").html( $.tmpl('_table', _cache._table.rows) );

    };
    
    me.buildRow = function(row) {

      var rowHTML,
          name = row[0],
          id = row[1],
          website = row[2],
          address = row[3],
          categories = row[4],
          summary = row[5],
          image = row[6],
          resourceURL = row[7],
          displayFilter = row[8]
          websiteHTML = '',
          summaryHTML = '',
          showMoreInfo = '',
          imageInfo = '';  //'<img class="table-img" src="/image?filter=' + displayFilter + '"/>';

      if (website != 'None') {
        websiteHTML = '<div class="cell table-link"><a target="_blank" href="'+
                         website +'">' + website + '</a></div>';
      }

      if (summary != 'None') {
        summaryHTML = '<div class="table-more" style="display: none;">' +
    			'<div class="cell table-info">' + summary + '</div>' +
    		'</div>';
        showMoreInfo = '<div class="table-toggle">More Information</div>';
      }

      /*
      // TODO(dbow): Temporarily removing images to speed frontend rendering.
      if (image == 'True') {
        imageInfo = '<img class="table-img" src="/image?wikiurl=' + wikiURL + '" />';
      } */

    	rowHTML = $(
    	'<div class="row clearfix" id="' + id + '">' +
    		'<div class="clearfix">' +
    			'<span class="ui-button ui-button-add"><span></span>Add to My Guide</span>' +
      		imageInfo +
      		'<div class="table-cells">' +
        		'<div class="cell table-name DIN-bold">' +
        		'<a target="_blank" href="'+ OP.WIKI_URL + resourceURL + '">' +
        		name + '</a></div>' +
        		'<div class="cell table-services">' + categories + '</div>' +
        		'<div class="cell table-address">' + address + '</div>' +
        		websiteHTML +
        		showMoreInfo +
      		'</div>' +
    		'</div>' +
    		summaryHTML +
    	'</div>'
    	).data('id', id).appendTo(_table);

    };
    
    me.print = function () {
    	var win = window.open('', 'Print'),
    		doc = win.document,
    		img = new Image(),
    		params,
    		markers = [];
    		
    	console.log('hi');

		doc.write('<html><head><title>Print' +
		          '<link type="text/css" rel="stylesheet" href="/static/global.css" />' +
		          '<link type="text/css" rel="stylesheet" href="/static/map.css" />' +
		          '</title></head><body></body></html>');
		doc.body.innerHTML = '<div style="position: relative; height: 1250px; width: 1000px;">' +
		                     $("#map").html() +
		                     '</div><div class="resources">' +
		                     $(".resources").html() + '</div>';
		
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
		return OP.SITE_ROOT + '/map?id=' + hash;
	};
	
	me.link2 = function (hash) {
		$('.rail-option-copy').val(me.url(hash)).show().select();
		$(document.body).one('click', function () {
			$('.rail-option-copy').hide();
		});
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
        $('.rail-option-copy').click(function (event) {
        	event.stopPropagation();
        	$(this).select();
        });
	};
	
	return me;
}());


OP.Map = (function () {
	var me = {},
	
		_hash,
		_data;
	
	me.print = function () {
		$('body').addClass('print');
		window.print();
		$('body').removeClass('print');
	};
	
	me.email = function () {
		OP.MyGuide.email2(_hash);
	};
	
	me.link = function (event) {
		event.stopPropagation();
		OP.MyGuide.link2(_hash);
	};
	
	me.createNew = function () {

		map = new google.maps.Map(document.getElementById('map'), {
			center: sf_latlng,
			zoom: 12,
			mapTypeId: 'roadmap',
			scrollwheel: false
		});
		
		layer = new google.maps.FusionTablesLayer(OP.FUSION_ID);
		layer.setMap(map);
		OP.Util.setHeights();
		
		google.maps.event.addListener(map, 'idle', function() {
			OP.FusionMap.changeData();
		
			if(!initial_bounds) {
				initial_bounds = map.getBounds();
			}
		
		});
	};
	
	me.createStatic = function (data) {
		_hash = data.url;
		_data = data;
		
		var queryText = "SELECT 'ID','GeocodedAddress' FROM " + OP.FUSION_ID + " WHERE ID IN (" + data.ids.join(',') + ")";
	      $.ajax({
	      	url: 'http://www.google.com/fusiontables/api/query',
	      	data: {sql: queryText},
	      	dataType: 'jsonp',
	      	jsonp: 'jsonCallback',
	      	success: me.receive
	      });
	      
	    
	};
	
	me.receive = function (data) {
		var pos, lat, long,
			latMax = -1000, latMin = 1000, longMax = -1000, longMin = 1000,
			sw, ne, bounds,
			map, ids, whereClause, layer;
		
		console.log(data);
		
		// find bounds
		for (var i in data.table.rows) {
			pos = data.table.rows[i][1].split(',');
			
			if (pos[0] !== 'None') {
				lat = parseFloat(pos[0]);
				long = parseFloat(pos[1]);
				
				if (latMax < lat) {
					latMax = lat;
				}
				if (latMin > lat) {
					latMin = lat;
				}
				
				if (longMax < long) {
					longMax = long;
				}
				if (longMin > long) {
					longMin = long;
				}
			}
		}
		
		map = new google.maps.Map(document.getElementById('map'), {
			center: sf_latlng,
			zoom: 13,
			disableDefaultUI: true,
			draggable: false,
			mapTypeId: 'roadmap',
			scrollwheel: false
		});
		
		if (latMin !== 1000) {
			sw = new google.maps.LatLng(latMin, longMin);
			ne = new google.maps.LatLng(latMax, longMax);
			bounds = new google.maps.LatLngBounds(sw, ne);
			
			map.fitBounds(bounds);
		}
			
		ids = _data.ids.join(',');
		whereClause = 'ID IN (' + ids + ')';
		
		layer = new google.maps.FusionTablesLayer({
			query: {
				select: 'Address',
				from: OP.FUSION_ID,
				where: whereClause
			}
		});
		
		layer.setMap(map);
	};
	
	me.setUp = function () {
		$('.header-sub-option-print').click(me.print);
		$('.header-sub-option-link').click(me.link);
		$('.header-sub-option-email').click(me.email);
		$('.rail-option-copy').click(function (event) {
        	event.stopPropagation();
        	$(this).select();
        });
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
	    var divinfo = '<embed src="/static/_clipboard.swf" FlashVars="clipboard=' +
	                  encodeURIComponent(text) +
	                  '" width="0" height="0" type="application/x-shockwave-flash"></embed>';
	    document.getElementById(flashcopier).innerHTML = divinfo;
	}
	
	me.setHeights = function () {
	  $("#rail").css('minHeight', $("#content").height() - 20);
	};

  return me;

}());




$(function () {
	if (location.pathname === '/map') {
		OP.Map.setUp();
	}  else {
		OP.Util.setUp();
	  OP.FusionMap.setUp();
	  OP.Cats.retrieve();
	  OP.Util.setHeights();
  }
});

}());
