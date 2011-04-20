google.load('visualization', '1', {'packages':['table']});

function changeData(cat) {
  var whereClause = "";
  if(cat && cat !== 'All') {
    whereClause = " WHERE 'Sub-category' LIKE '" + cat + "'";
  }
  var queryText = encodeURIComponent("SELECT 'Name of org','Sub-category','URL' FROM 652548" + whereClause);
  var query = new google.visualization.Query('http://www.google.com/fusiontables/gvizdata?tq='  + queryText);
  query.send(getData);
}

function getData(response) {
  var table = new google.visualization.Table(document.getElementById('table'));
  options = {'showRowNumber': true, 'height': 450}
  table.draw(response.getDataTable(), options);
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
  setUpCategories(final_list);
}

function setUpCategories(categories) {
 /* 	var categories = [
	   {cat: 'All'},
	   {cat: 'Housing / Shelter'},
	   {cat: 'AIDS Treatment / Prevention'},
	]; */
	
	var cats = $("#cats"),
        tmpl = cats.html();
    
    cats.html('');
	$.tmpl(tmpl, categories).click(selectCat).mouseover(hoverCat).mouseout(hoverCat).appendTo("#cats");
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

$(function () {
	changeData();
	createMap();
	getCategoryList();
});