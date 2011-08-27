$(function () {

  $('.resource_update > input').click(function() {
    var wikiUrl = $(this).parent().siblings('.resource_url').text();
    var status = $(this).prev().val();
    $('[name=wiki_url]').val(wikiUrl);
    $('[name=action]').val('Update');
    $('[name=status]').val(status);
    $('#resource_form').submit();
  });
  $('.resource_sync > input').click(function() {
    var wikiUrl = $(this).parent().next().next().text();
    $('[name=wiki_url]').val(wikiUrl);
    $('[name=action]').val('WikiSync');
    $('#resource_form').submit();
  });
  $('.resource_fusion_sync > input').click(function() {
    var wikiUrl = $(this).parent().next().text();
    $('[name=wiki_url]').val(wikiUrl);
    $('[name=action]').val('FusionSync');
    $('#resource_form').submit();
  });
  var incomplete_num = $('#incomplete > .resource_table tr').length - 1;
  $('#incomplete_num').text(incomplete_num + ' remaining.');
  var complete_num = $('#complete > .resource_table tr').length - 1;
  $('#complete_num').text(complete_num + ' completed.');
  var excluded_num = $('#excluded > .resource_table tr').length - 1;
  $('#excluded_num').text(excluded_num + ' excluded.');
  var deleted_num = $('#deleted > .resource_table tr').length - 1;
  $('#deleted_num').text(deleted_num + ' deleted.');
});