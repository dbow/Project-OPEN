var OP = {};

(function () {

OP.SITE_ROOT = location.protocol + '//' + location.host;
OP.WIKI_URL = 'http://sfhomeless.wikia.com/wiki/';
OP.FUSION_ID = 1293272;

var map;
var initialBounds;
var sf_latlng = new google.maps.LatLng(37.77493,-122.419416);

/**
 * The namespace for code creating and updating the main resource map.
 */
OP.FusionMap = (function () {

    var me = {},
        _targetLocation,
        _markers, // All markers created originally.
        _visibleMarkers = [], // The IDs of currently visible markers.
        _infoWindow = new google.maps.InfoWindow({}),
        _image = new google.maps.MarkerImage( // The test custom marker icon.
          '/static/img/test_icon.png',
          new google.maps.Size(20, 23),
          new google.maps.Point(0,0),
          new google.maps.Point(10, 23)),
        _shape = {
          coord: [1, 1, 1, 20, 18, 20, 18 , 1],
          type: 'poly'
          };

    me.getVisible = function () {
      return _visibleMarkers;
    };

    /**
     * Retrieves all resources within the current map bounds, and
     * then calls OP.Data.receive with the results.
     */
    me.changeData = function () {

      var mapBounds = map.getBounds();
      if (mapBounds) {
        _visibleMarkers = [];
        for (i in _markers) {
          var marker = _markers[i];
          if (mapBounds.contains(marker.getPosition())) {
            _visibleMarkers.push(marker.title);
          }
        }
        OP.Data.filter();
      }
      
      // TODO(dbow): REMOVE BELOW WHEN FUSIONTABLES NO LONGER NEEDED
      /*
      var whereClause = "";
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
      */
        
    };

    /**
     * Creates a map centered on San Francisco and
     * an event listener when the map goes idle that calls changeData().
     */
    me.createMap = function () {

      map = new google.maps.Map(document.getElementById('map'), {
        center: sf_latlng,
        zoom: 12,
        mapTypeId: 'roadmap',
        scrollwheel: false
      });
      
      me.updateLayer(null);

      OP.Util.setHeights();

      google.maps.event.addListener(map, 'idle', function() {
        me.changeData();
        if(!initialBounds) {
          initialBounds = map.getBounds();
        }
      });
      google.maps.event.addListener(map, 'dragend', function() {
        var trackingObject = {'Category':'Map',
                              'Action': 'Drag'};
        OP.Util.logEvent(trackingObject);
      });
      google.maps.event.addListener(map, 'zoom_changed', function() {
        var trackingObject = {'Category':'Map',
                              'Action': 'Zoom'};
        OP.Util.logEvent(trackingObject);
      });
      
    };
    
    /**
     * Updates the map to include the currently filtered set of resources.
     * @param {Array.<string>} ids A list of resource IDs.
     */
    me.updateLayer = function (ids) {
      
      var isUpdate = true;
      if (!_markers) {
        isUpdate = false;
        _markers = {};
      }

      for (var j in _markers) {
        _markers[j].setMap(null);
      }

      var allResources = false;
      if (!ids) {
        ids = OP.resourceList;
        allResources = true;
      }

      for (var id in ids) {
        if (!allResources) {
          id = ids[id];
        }
        if (isUpdate) {
          _markers[id].setMap(map);
        } else {
          var resource = OP.resourceList[id];
          var resCoords = resource['GeocodedAddress'].split(',');
          var resourceLatLng = new google.maps.LatLng(parseFloat(resCoords[0]),
                                                      parseFloat(resCoords[1]));
          var marker = new google.maps.Marker({
              position: resourceLatLng,
              map: map,
              shape: _shape,
              title: id,
          });
          if (resource['DisplayFilter'] == 'Other') {
            marker.setIcon(_image);
          }
          _markers[id] = marker;
          me.setupInfoWindow(marker, id);
        }        
      }

      // TODO(dbow): REMOVE BELOW WHEN FUSIONTABLES NO LONGER NEEDED
      /*
      var queryParams = {
        select: 'Address',
        from: OP.FUSION_ID,
      };
      if (ids != 'all') {
        var idString = '0';
        if (ids.length) {
          // TODO(dbow): Figure out a better solution for this:
          //   Very broad queries can generate URIs that are too large
          //   so only the first ~170 or so IDs are submitted.
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
        // TODO(dbow): Figure out a better solution for this:
        //   FusionTablesLayer only supports up to 5 custom styles...
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
      */

    };
    
    /**
     * Creates a click listener (with a closure) to customize the content
     * of the InfoWindow based on which marker is clicked.
     * @param {google.maps.Marker} marker The marker that was clicked.
     * @param {string} id The ID of the resource corresponding to the marker.
     */
    me.setupInfoWindow = function (marker, id) {
      
      google.maps.event.addListener(marker, 'click', function(e) {
        _infoWindow.setContent(me.retrieveInfoWindowHTML(id));
        _infoWindow.open(map, marker);
        var trackingObject = {'Category':'Map',
                              'Action': 'Marker Click',
                              'Label': OP.resourceList[id]['Name']};
        OP.Util.logEvent(trackingObject);
      });

    };

    /**
     * Sets the content of the InfoWindow to the clicked resource.
     * @param {string} resourceId The ID of the resource clicked.
     */
    me.retrieveInfoWindowHTML = function (resourceId) {

        var resource = OP.resourceList[resourceId];
        var infoWindowHtml = '<div style="color:#e4542e; font-size:18px">' +
                           resource['Name'] + '</div>';
        if (resource['Categories']) {
          infoWindowHtml += '<div class="table-services">' +
                               resource['Categories'] + '</br></div>';
        }
        if (resource['Address'] ||
            resource['Phone'] ||
            resource['Hours']) {
          infoWindowHtml += '<div class="table-address">';
          if (resource['Address']) {
            infoWindowHtml += resource['Address'] + '</br>';
          }
          if (resource['Phone']) {
            infoWindowHtml += resource['Phone'] + '</br>';
          }
          if (resource['Hours']) {
            infoWindowHtml += resource['Hours'];
          }
          infoWindowHtml += '</div>';
        }
        return infoWindowHtml;
    };

    /**
     * Geolocates the provided string and updates the map to frame that location.
     * @param {string} location A query string representing an address.
     */
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
    
    /**
     * Alerts the user if GeoLocation failed and sets map center to a default location.
     * @param {boolean} errorFlag A boolean indicating if a specific error was returned.
     */
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

    /**
     * Creates the map and sets up the event handler for location searches.
     */
    me.setUp = function () {
      me.createMap();
      $('#location').submit(function() {
        var locationQuery = $("#location-form input:first").val();
        me.updateMap(locationQuery);
        var trackingObject = {'Category':'Map',
                              'Action': 'Location Search',
                              'Label': locationQuery};
        OP.Util.logEvent(trackingObject);
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
            var trackingObject = {'Category':'Filters',
                                  'Action': 'All'};
            OP.Util.logEvent(trackingObject);
        }
        else if (el.hasClass('on')) {
            el.removeClass('on');
            delete _selected[el.text()];
            var trackingObject = {'Category':'Filters',
                                  'Action': 'Remove',
                                  'Label': el.text()};
            OP.Util.logEvent(trackingObject);
        }
        else {
            $(this).addClass('on');
            $("#cats .cat-all").removeClass('on');
            _selected[el.text()] = 1;
            var trackingObject = {'Category':'Filters',
                                  'Action': 'Add',
                                  'Label': el.text()};
            OP.Util.logEvent(trackingObject);
        }
        
        OP.Data.filter();
    };
    
    return me;
}());


OP.Data = (function () {

    var me = {},
    _table = $("#table").html(''),
    _tmpl = $("#table").template('table'),
    _visible = [], // The IDs of the resources visible on the map.
    _filtered = [], // The IDs returned after category filtering.
    _results = []; // The IDs returned after both category and search filtering.
    //_ids = []; // The IDs of the _results rows.
    
    $("#table").html('');

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

      var search = $("#search-box"),
          // rows = _filtered,
          // _table = $("#table").html(''),
          _ids = [],
          searchPerformed = false,
          searchQuery = search.val(),
          searchFields = ['Name',
                          'Website',
                          'Address',
                          'Categories',
                          'FilterCategories',
                          'Summary',
                          'Phone',
                          'Email',
                          'Languages'],
          numSearchFields = searchFields.length;

      if (searchQuery && searchQuery !== search.attr('title')) {

        _results = [];

        for (var id in _filtered) {

          var resourceId = _filtered[id],
              rowMatches = false;
          var searchRegex = new RegExp($('#search-box').val(), 'i');
          var resource = OP.resourceList[resourceId];
          for (i = 0; i < numSearchFields; i++) {
            if (searchRegex.test(resource[searchFields[i]])) {
              rowMatches = true;
            }
          }
          if (rowMatches) {
              _results.push(resourceId);
          }
        }

      } else {
        _results = _filtered;
      }

      $("#table").show();
      OP.Util.setHeights();
      me.displayRows(_results);
      OP.FusionMap.updateLayer(_results);
    };
    
    me.displayRows = function(resultSet) {
      
      if (resultSet) {
        $('.row').each(function() {
    		  $(this).addClass('invisible');
    		});
    		var resultLen = resultSet.length;
        for (i = 0; i < resultLen; i++) {
          $('#' + resultSet[i]).removeClass('invisible');
        }
      } else {
        $('.row').each(function() {
    		  $(this).removeClass('invisible');
    		});
      }
      
    };
    
    me.filter = function () {
    	var cats = OP.Util.toArrayKeys(OP.Cats.getSelected()),
    		// _table = $("#table").html(''),
    		catsKeyed = {};

        _visible = OP.FusionMap.getVisible();
        
        if (cats && cats.length) {
        	for (i = 0; i < cats.length; i++) {
        	  catsKeyed[cats[i]] = 1;
        	}
        	_filtered = [];
        	_table.hide();
        	
          /*
            TODO(dbow): If we decide to have search results dictate the bounds of
            the map, we'll need to uncomment and complete the code in the sections below.
          */

          //var geocoder = new google.maps.Geocoder();
          //var bounds = new google.maps.LatLngBounds();
        
          for (var i in _visible) {
            var resourceId = _visible[i];
            var resource = OP.resourceList[resourceId];
            var inCategory = false;
            var filteredCats = resource['FilterCategories'].toString().split(', ');
            var filteredLen = filteredCats.length;
            for (var j = 0; j < filteredLen; j++) {
              if(catsKeyed[filteredCats[j]]) {
                inCategory = true;
              }
            }
          	if (!cats || inCategory) {
        		
          		_filtered.push(resourceId);
        		
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
        } else {
          _filtered = _visible;
        }
        
        me.performSearch();
        
        //map.fitBounds(bounds);

    };
    
    me.buildRows = function() {
      
      for (resourceId in OP.resourceList) {
        
        var rowHTML,
            resource = OP.resourceList[resourceId],
            name = resource['Name'],
            id = resourceId,
            website = resource['Website'],
            address = resource['Address'],
            categories = resource['Categories'],
            summary = resource['Summary'],
            image = resource['Image'],
            resourceURL = resource['WikiUrl'],
            displayFilter = resource['DisplayFilter']
            websiteHTML = '',
            summaryHTML = '',
            showMoreInfo = '',
            clickTracking = '',
            imageInfo = '<img class="table-img" src="http://projectopensf.org/image?filter=' + displayFilter + '"/>';

        if (website) {
          websiteHTML = '<div class="cell table-link"><a target="_blank" href="'+
                           website +'">' + website + '</a></div>';
        }

        if (summary) {
          summaryHTML = '<div class="table-more" style="display: none;">' +
      			'<div class="cell table-info">' + summary + '</div>' +
      		'</div>';
          showMoreInfo = '<div class="table-toggle">More Information</div>';
        }

        if (image == 'True') {
          imageInfo = '<img class="table-img" src="http://projectopensf.org/image?wikiurl=' + resourceURL + '" />';
        }
      
        clickTracking = 'var trackingObject = ' +
            '{\'Category\':\'Outbound Clicks\',' +
             '\'Action\': \'Resource\',' +
             '\'Label\': \'' + name + '\'};' +
             'OP.Util.logEvent(trackingObject);';

      	rowHTML = $(
      	'<div class="row clearfix" id="' + id + '">' +
      		'<div class="clearfix">' +
      			'<span class="ui-button ui-button-add"><span></span>Add to My Guide</span>' +
      			  '<div class="table-img-container">' +
        		  imageInfo +
        		  '</div>' +
        		'<div class="table-cells">' +
          		'<div class="cell table-name DIN-bold">' +
          		'<a target="_blank" href="'+ OP.WIKI_URL + resourceURL + '" ' +
          		'onClick="' + clickTracking + '">' +
          		name + '</a></div>' +
          		'<div class="cell table-services">' + categories + '</div>' +
          		'<div class="cell table-address">' + address +
          		' <a href="#" class="table-address-update">Go Here</a></div>' +
          		websiteHTML +
          		showMoreInfo +
        		'</div>' +
      		'</div>' +
      		summaryHTML +
      	'</div>'
      	).data('id', id).appendTo(_table);

      }
    };
    
    me.updateLocationLinks = function () {
      $('a.table-address-update').live('click', function(e) {
        e.preventDefault();
        var address = $(this).parent().text().replace('Go Here','');
        OP.FusionMap.updateMap(address);
        var trackingObject = {'Category':'Map',
                              'Action': 'Go here',
                              'Label': address};
        OP.Util.logEvent(trackingObject);
      });
    }
    
    me.print = function () {
    	var win = window.open('', 'Print'),
    		doc = win.document,
    		img = new Image(),
    		params,
    		markers = [];

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
    	
    	var rowName = el.siblings('.table-cells').children('.table-name').text();
    	var trackingObject = {'Category':'My Guide Interactions',
                            'Action': 'Add',
                            'Label': rowName};
      OP.Util.logEvent(trackingObject);
	}
	
	function _clickRemove() {
		var el = $(this).parent(),
			id = el.data('id');
	
		el.fadeOut(function () {
			el.remove();
		});
		
		delete _current[id];
		
	  var rowName = el.children('.table-name').text();
  	var trackingObject = {'Category':'My Guide Interactions',
                          'Action': 'Remove',
                          'Label': rowName};
    OP.Util.logEvent(trackingObject);
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
		var trackingObject = {'Category':'My Guide Maps',
                          'Action': 'Link',
                          'Label': hash,
                          'Value': _guides[hash].length};
    OP.Util.logEvent(trackingObject);
	}
	me.link = function () {
		me.save(me.link2);
	};
	
	me.email2 = function (hash) {
		window.location = 'mailto:?subject=projectOPEN Map&body=' + me.url(hash);
		var trackingObject = {'Category':'My Guide Maps',
                          'Action': 'Email',
                          'Label': hash,
                          'Value': _guides[hash].length};
    OP.Util.logEvent(trackingObject);
	};
	me.email = function () {
		me.save(me.email2);
	};
	
	me.print = function () {
		me.save(function (hash) {
			window.open(me.url(hash));
			var trackingObject = {'Category':'My Guide Maps',
                            'Action': 'Print',
                            'Label': hash,
                            'Value': _guides[hash].length};
      OP.Util.logEvent(trackingObject);
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
    		var trackingObject = {'Category':'UI Interactions',
                              'Action': 'Hide Filters'};
        OP.Util.logEvent(trackingObject);
    	}, function () {
    		$(this).text('Hide Filters').removeClass('ui-off');
    		$('#cats').slideDown();
    		var trackingObject = {'Category':'UI Interactions',
                              'Action': 'Show Filters'};
        OP.Util.logEvent(trackingObject);
    	});
    	
    	//set up table toggler
    	$("#table").delegate('.table-toggle', 'click', function () {
        	var el = $(this);
        	if (el.text() === 'More Information') {
        		el.text('Less Information').addClass('ui-off');
        		el.parent().parent().siblings().slideDown();
        		var trackingObject = {'Category':'UI Interactions',
                                  'Action': 'Show More Information',
                                  'Label': el.siblings('.table-name').text()};
            OP.Util.logEvent(trackingObject);
        	}
        	else {
        		el.text('More Information').removeClass('ui-off');
        		el.parent().parent().siblings().slideUp();
        		var trackingObject = {'Category':'UI Interactions',
                                  'Action': 'Hide More Information',
                                  'Label': el.siblings('.table-name').text()};
            OP.Util.logEvent(trackingObject);
        	}
        });
        
        //set up rail toggler
        $(".rail-hide").click(function () {
        	$("#page").addClass('page-wide');
        	var trackingObject = {'Category':'UI Interactions',
                                'Action': 'Hide My Guide'};
          OP.Util.logEvent(trackingObject);
        });
        $(".rail-show").click(function () {
        	$("#page").removeClass('page-wide');
        	var trackingObject = {'Category':'UI Interactions',
                                'Action': 'Show My Guide'};
          OP.Util.logEvent(trackingObject);
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
	
	me.logEvent = function (args) {
	  var gaEvent = ['_trackEvent'],
	      category = args['Category'],
	      action = args['Action'],
	      label = args['Label'],
	      value = args['Value'];

    gaEvent.push(category);
    gaEvent.push(action);
    if(label) {
      gaEvent.push(label);
    }
    if(value) {
      gaEvent.push(value);
    }
	  _gaq.push(gaEvent);
	};

  return me;

}());




$(function () {
	if (location.pathname === '/map') {
		OP.Map.setUp();
	} else if (location.pathname != '/about' &&
	           location.pathname != '/faq' &&
	           location.pathname != '/contact') {
		OP.Util.setUp();
	  OP.FusionMap.setUp();
	  OP.Data.buildRows();
	  OP.Cats.retrieve();
	  OP.Util.setHeights();
	  OP.Data.updateLocationLinks();
  }
});

}());
