google.load('visualization', '1', {'packages':['table']});

var OP = {};

(function () {

function changeData(cat, map) {
  var whereClause = "";

  if (map) {
    map_bounds = map.getBounds();
    whereClause = " WHERE ST_INTERSECTS('Address', RECTANGLE(LATLNG" + map_bounds.getSouthWest() + ", LATLNG" + map_bounds.getNorthEast() + "))";
  }
  
  var queryText = "SELECT 'Name of org','Sub-category','URL' FROM 652548" + whereClause;
  
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
  console.log(response.getDataTable());
  var table = new google.visualization.Table(document.getElementById('table'));
  options = {showRowNumber: true, maxHeight: 1000, width: 760}
  table.draw(response.getDataTable(), options);
  setHeights();
}

/* An alternative presentation:

function getData(response) {
  numRows = response.getDataTable().getNumberOfRows();
  numCols = response.getDataTable().getNumberOfColumns();
  
  fusiontabledata = "<b>";
  for(i = 0; i < numCols; i++) {
    fusiontabledata += response.getDataTable().getColumnLabel(i) + ",";
  }
  fusiontabledata += "</b><br />";
  
  for(i = 0; i < numRows; i++) {
    for(j = 0; j < numCols; j++) {
      fusiontabledata += response.getDataTable().getValue(i, j) + ", ";
    }
    fusiontabledata += "<br />";
  }  
  document.getElementById('content').innerHTML = fusiontabledata;
} */


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

  layer = new google.maps.FusionTablesLayer(652548);
  layer.setMap(map);
  setHeights();

  google.maps.event.addListener(map, 'bounds_changed', function() {
      changeData(null, map);
  });
}

function selectCat() {
    changeData($(this).html());
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
    $("#rail").css('minHeight', $("#subpage").height() - 20);
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
        
        for (var i in rows) {
        	if (!cats || catsKeyed[rows[i][1]]) {
	        	html += '<div class="row clearfix">';
	        	for (var j in rows[i]) {
	        		html += '<div class="cell cell' + j + '">' + rows[i][j] + '</div>';
	        	}
	        	html += '</div>';
        	}
        }
        
        $("#table").html(html);
        
		//$("#table").html( $.tmpl('table', _cache.table.rows) );
        setHeights();
    };
    
    me.receive = function (response) {
        _cache = response;
        console.log(_cache);
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