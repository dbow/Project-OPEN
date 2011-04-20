google.load('visualization', '1');

function changeData(scorer) {
  var whereClause = "";
  if(scorer) {
    whereClause = " WHERE 'Scoring Team' LIKE '" + scorer + "'";
  }
  var queryText = encodeURIComponent("SELECT 'URL' FROM 652548" + whereClause);
  var query = new google.visualization.Query('http://www.google.com/fusiontables/gvizdata?tq='  + queryText);
  
  query.send(getData);
}

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
  document.getElementById('ftdata').innerHTML = fusiontabledata;
}

$(function () {
	changeData();
});