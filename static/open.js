google.load('visualization', '1', {'packages':['table']});

function changeData(type) {
  var whereClause = "";
  if(type) {
    whereClause = " WHERE 'Sub-category' LIKE '" + type + "'";
  }
  var queryText = encodeURIComponent("SELECT 'Name of org','Sub-category','URL' FROM 652548" + whereClause);
  var query = new google.visualization.Query('http://www.google.com/fusiontables/gvizdata?tq='  + queryText);
  console.log(query);
  query.send(getData);
}

function getData(response) {
  var table = new google.visualization.Table(document.getElementById('table'));
  table.draw(response.getDataTable(), {showRowNumber: true});
}

function getDataHTML(response) {
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
  document.getElementById('ftdata').innerHTML = fusiontabledata;
}

$(function () {
	changeData();
});