google.load('visualization', '1', {'packages':['table']});

var OP = {};

(function () {

function changeData(cats) {
  var whereClause = "";
  
  if (cats.length) {
    whereClause = cats.join(' ');
    whereClause = " WHERE 'Sub-category' = '" + whereClause + "'";
  }
  
  var queryText = encodeURIComponent("SELECT 'Name of org','Sub-category','URL' FROM 652548" + whereClause);
  var query = new google.visualization.Query('http://www.google.com/fusiontables/gvizdata?tq='  + queryText);
  query.send(OP.Data.receive);
}

function getData(response) {
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
    _table;
    
    me.getCache = function () {
        return _cache.getDataTable();
    };
    me.getTable = function () {
        return _table;
    };
    
    me.filter = function (cats) {
        cats = cats || [];
        
        var table = _cache.getDataTable();
        
        table.getFilteredRows([{column: 1, value: 'Food'}]);
    
        _table = new google.visualization.Table(document.getElementById('table'));
        options = {showRowNumber: true, maxHeight: 1000, width: 760}
        _table.draw(_cache.getDataTable(), options);
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
	changeData([]);
	createMap();
	getCategoryList();
	setHeights();
});

}());